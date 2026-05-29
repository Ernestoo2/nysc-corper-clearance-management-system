import PizZip from "pizzip";

const WORD_XML = /^word\/(document|header\d*|footer\d*)\.xml$/;

/** Placeholders used across NYSC / PG letter templates. */
const KNOWN_MERGE_TAGS = new Set([
    "referenceNo",
    "ref",
    "formattedIssueDate",
    "issueDate",
    "currentDate",
    "date",
    "fullName",
    "callUpNumber",
    "stateCode",
    "batch",
    "deploymentUnit",
    "effectiveDate",
    "formattedEffectiveDate",
    "reportingOfficer",
    "monthCovered",
    "allowanceMonth",
    "formattedAddress",
    "salutationLine",
    "faculty",
    "department",
    "degreeType",
    "programme",
    "programmeFull",
    "programmeOption",
    "academicSession",
    "sessionStartDate",
    "formattedSessionStartDate",
]);

function paragraphPlainText(paragraphXml: string) {
    return [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((match) => match[1] ?? "")
        .join("");
}

/**
 * Word often splits `{tag}` across runs or omits `}` before the next paragraph.
 * docxtemplater then reports "Multi error" / "Unclosed tag".
 */
export function repairDocxPlaceholderXml(xml: string) {
    return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
        const text = paragraphPlainText(paragraph);
        const openTag = text.match(/\{([A-Za-z][A-Za-z0-9]*)$/);
        if (!openTag) return paragraph;

        const tag = openTag[1]!;
        if (!KNOWN_MERGE_TAGS.has(tag)) return paragraph;
        if (paragraph.includes("<w:t>}</w:t>") || paragraph.includes('<w:t xml:space="preserve">}</w:t>')) {
            return paragraph;
        }

        const closingRun =
            '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr><w:t>}</w:t></w:r>';

        return paragraph.replace(/<\/w:p>\s*$/, `${closingRun}</w:p>`);
    });
}

export function repairDocxZip(zip: PizZip) {
    for (const fileName of Object.keys(zip.files)) {
        if (!WORD_XML.test(fileName)) continue;
        const file = zip.files[fileName];
        if (!file) continue;
        const repaired = repairDocxPlaceholderXml(file.asText());
        zip.file(fileName, repaired);
    }
    return zip;
}

export function repairDocxBuffer(templateBytes: ArrayBuffer) {
    const zip = new PizZip(templateBytes);
    repairDocxZip(zip);
    return zip;
}
