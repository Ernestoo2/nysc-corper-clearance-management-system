'use client'

import { useParams } from 'next/navigation'

export default function CorperDashboard() {
    const params = useParams()
    const callUpNumber = decodeURIComponent(params.id as string)

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-[#1F4E79] mb-8">
                    Corps Member Dashboard
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                    Welcome, {callUpNumber}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Clearance Status</h2>
                        <p className="text-gray-600">Track your clearance progress</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Documents</h2>
                        <p className="text-gray-600">Upload and manage documents</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold mb-4">Profile</h2>
                        <p className="text-gray-600">Update your information</p>
                    </div>
                </div>
            </div>
        </div>
    )
}