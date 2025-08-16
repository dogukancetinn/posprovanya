"use client"

export default function SyntheticV0PageForDeployment() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">PROVANYA POS</h1>
        <p className="text-gray-600 mb-6">Bu bir Electron masaüstü uygulamasıdır.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium">Uygulamayı çalıştırmak için:</p>
          <code className="block mt-2 bg-gray-800 text-green-400 p-2 rounded">npm run dev</code>
        </div>
      </div>
    </div>
  )
}
