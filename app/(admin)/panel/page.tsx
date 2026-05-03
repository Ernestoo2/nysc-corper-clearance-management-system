export default function AdminPanel() {
    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-[#1F4E79] mb-8">
                    Admin Panel
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Corpers</h2>
                        <p className="text-gray-600">Manage corps members</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Clearance</h2>
                        <p className="text-gray-600">Process clearances</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Reports</h2>
                        <p className="text-gray-600">Generate reports</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Settings</h2>
                        <p className="text-gray-600">System configuration</p>
                    </div>
                </div>
            </div>
        </div>
    )
}