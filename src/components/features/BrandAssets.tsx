import { Download } from "lucide-react";

export default function BrandAssets() {
  const assets = [
    {
      name: "PayNow Logo",
      description:
        "Primary logo for use on websites, apps, and marketing materials",
      url: "https://mocha-cdn.com/019aa842-cd89-7a58-8535-534d63b3bcf1/paynow-current-logo.png",
      filename: "paynow-current-logo.png",
      dimensions: "1248x832px",
    },
    {
      name: "PayNow Favicon",
      description:
        "Icon-only app icon with gradient box and lightning bolt for browser tabs, bookmarks, and mobile home screens",
      url: "https://mocha-cdn.com/019aa842-cd89-7a58-8535-534d63b3bcf1/ChatGPT-Image-Dec-7-2025-05_22_17-AM.png",
      filename: "paynow-icon-only.png",
      dimensions: "1024x1024px",
    },
  ];

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback to opening in new tab
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Brand Assets
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Download official PayNow brand assets for your projects
          </p>
        </div>

        {/* Assets Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {assets.map((asset) => (
            <div
              key={asset.filename}
              className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100"
            >
              {/* Asset Preview */}
              <div className="bg-gradient-to-br from-gray-50 to-primary-50/20 p-12 flex items-center justify-center min-h-[300px]">
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="max-w-full max-h-[200px] object-contain drop-shadow-lg"
                />
              </div>

              {/* Asset Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {asset.name}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  {asset.description}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500 font-medium">
                    {asset.dimensions}
                  </span>
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                    PNG
                  </span>
                </div>
                <button
                  onClick={() => handleDownload(asset.url, asset.filename)}
                  className="w-full gradient-primary text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Brand Guidelines Section */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Brand Guidelines
          </h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Primary Colors
              </h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div
                    className="w-full h-16 rounded-lg"
                    style={{ backgroundColor: "#6366f1" }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    #6366f1
                  </p>
                  <p className="text-xs text-gray-500">Primary Purple</p>
                </div>
                <div className="flex-1">
                  <div
                    className="w-full h-16 rounded-lg"
                    style={{ backgroundColor: "#8b5cf6" }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    #8b5cf6
                  </p>
                  <p className="text-xs text-gray-500">Primary Indigo</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Accent Colors
              </h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div
                    className="w-full h-16 rounded-lg"
                    style={{ backgroundColor: "#10b981" }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    #10b981
                  </p>
                  <p className="text-xs text-gray-500">Accent Green</p>
                </div>
                <div className="flex-1">
                  <div
                    className="w-full h-16 rounded-lg"
                    style={{ backgroundColor: "#059669" }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    #059669
                  </p>
                  <p className="text-xs text-gray-500">Dark Green</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Typography</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-bold">Primary Font:</span> Plus Jakarta Sans
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-bold">Weights:</span> 400 (Regular), 500
              (Medium), 600 (Semi-Bold), 700 (Bold), 800 (Extra Bold)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
