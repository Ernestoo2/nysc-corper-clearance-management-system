import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { repairDocxBuffer } from "./repairDocxTemplate";

export type MergeData = Record<string, string | number | boolean | MergeData[]>;

type DocxtemplaterError = {
    properties?: {
        errors?: Array<{
            message?: string;
            properties?: { explanation?: string; xtag?: string };
        }>;
    };
    message?: string;
};

export function formatDocxMergeError(error: unknown): string {
    const err = error as DocxtemplaterError;
    const details =
        err.properties?.errors
            ?.map((item) => item.properties?.explanation ?? item.message)
            .filter(Boolean) ?? [];

    if (details.length > 0) {
        return details.join(" ");
    }

    return error instanceof Error ? error.message : "DOCX merge failed";
}

export async function mergeDocxTemplate(
    templateBytes: ArrayBuffer,
    data: MergeData
): Promise<Blob> {
    const zip = repairDocxBuffer(templateBytes);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
    });
    doc.render(data);
    const blob = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }) as Blob;
    return blob;
}

export async function fetchAndMergeDocx(downloadUrl: string, data: MergeData): Promise<Blob> {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
        throw new Error(`Failed to download template (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    try {
        return await mergeDocxTemplate(buffer, data);
    } catch (error) {
        throw new Error(formatDocxMergeError(error));
    }
}

const PAGE_BREAK_XML = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

/** Remove loop markers so a “bulk” template works as a single-letter page. */
function stripCorpersLoopTags(xml: string) {
    return xml
        .replace(/\{#corpers\}/g, "")
        .replace(/\{\/corpers\}/g, "")
        .replace(/\{#\s*corpers\s*\}/g, "")
        .replace(/\{\/\s*corpers\s*\}/g, "");
}

function prepareSingleLetterTemplate(templateBytes: ArrayBuffer) {
    const zip = repairDocxBuffer(templateBytes);
    const docPath = "word/document.xml";
    const file = zip.files[docPath];
    if (file) {
        zip.file(docPath, stripCorpersLoopTags(file.asText()));
    }
    return zip;
}

function extractBodyInnerXml(documentXml: string) {
    const match = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
    if (!match) throw new Error("Invalid document.xml in merged DOCX");
    return match[1]!.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "").trim();
}

function extractSectionProperties(documentXml: string) {
    const match = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    return match?.[0] ?? "";
}

export function combineDocxBuffers(buffers: ArrayBuffer[]): Blob {
    if (buffers.length === 0) {
        throw new Error("No documents to combine");
    }

    const firstZip = new PizZip(buffers[0]);
    const docPath = "word/document.xml";
    const firstXml = firstZip.files[docPath]!.asText();
    const bodyParts = [extractBodyInnerXml(firstXml)];
    let sectPr = extractSectionProperties(firstXml);

    for (let i = 1; i < buffers.length; i++) {
        const xml = new PizZip(buffers[i]).files[docPath]!.asText();
        bodyParts.push(extractBodyInnerXml(xml));
        sectPr = extractSectionProperties(xml) || sectPr;
    }

    const combinedBody = bodyParts.join(PAGE_BREAK_XML) + sectPr;
    const mergedXml = firstXml.replace(
        /<w:body[^>]*>[\s\S]*<\/w:body>/,
        `<w:body>${combinedBody}</w:body>`
    );
    firstZip.file(docPath, mergedXml);

    return firstZip.generate({
        type: "blob",
        mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }) as Blob;
}

/** One page per corper — no {#corpers} loop required in the Word template. */
export async function mergeDocxTemplateFromPreparedZip(zip: PizZip, data: MergeData): Promise<Blob> {
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
    });
    doc.render(data);
    return doc.getZip().generate({
        type: "blob",
        mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }) as Blob;
}

export async function fetchAndMergeBulkClearance(
    downloadUrl: string,
    corpers: MergeData[]
): Promise<Blob> {
    if (corpers.length === 0) {
        throw new Error("Select at least one corper");
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
        throw new Error(`Failed to download template (${response.status})`);
    }
    const templateBytes = await response.arrayBuffer();
    const preparedTemplateBytes = prepareSingleLetterTemplate(templateBytes).generate({
        type: "arraybuffer",
    }) as ArrayBuffer;

    try {
        const mergedBuffers: ArrayBuffer[] = [];
        for (const data of corpers) {
            const blob = await mergeDocxTemplateFromPreparedZip(
                new PizZip(preparedTemplateBytes),
                data
            );
            mergedBuffers.push(await blob.arrayBuffer());
        }
        return combineDocxBuffers(mergedBuffers);
    } catch (error) {
        throw new Error(formatDocxMergeError(error));
    }
}
