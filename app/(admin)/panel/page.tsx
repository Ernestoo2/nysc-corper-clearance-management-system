import Link from "next/link";

export default function AdminPanel() {
    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-[#1F4E79] mb-8">
                    Admin Panel
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link href="/panel/corpers" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-semibold mb-4">Corpers</h2>
                        <p className="text-gray-600">Manage corps members</p>
                    </Link>

                    <Link href="/panel/clearance" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-semibold mb-4">Clearance</h2>
                        <p className="text-gray-600">Bulk monthly clearance generation</p>
                    </Link>

                    <Link href="/panel/letters/templates" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-semibold mb-4">Letter templates</h2>
                        <p className="text-gray-600">Upload DOCX templates and test merge</p>
                    </Link>

                    <Link href="/panel/reports" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-semibold mb-4">Reports</h2>
                        <p className="text-gray-600">Generate registry and summary reports</p>
                    </Link>

                    <Link href="/panel/settings" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-semibold mb-4">Settings</h2>
                        <p className="text-gray-600">Environment and integration status</p>
                    </Link>
                </div>
            </div>
        </div>
    )
}