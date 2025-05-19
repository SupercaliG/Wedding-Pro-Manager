"use client";

interface RoutePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin: string;
  destination: string;
  jobTitle: string;
}

export function RoutePreviewModal({ 
  isOpen, 
  onClose, 
  origin, 
  destination, 
  jobTitle 
}: RoutePreviewModalProps) {
  if (!isOpen) return null;
  
  // Encode addresses for Google Maps URL
  const encodedOrigin = encodeURIComponent(origin);
  const encodedDestination = encodeURIComponent(destination);
  const mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${encodedOrigin}&destination=${encodedDestination}&mode=driving`;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Route to {jobTitle}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <iframe
            className="w-full h-full border-0 rounded"
            loading="lazy"
            allowFullScreen
            src={mapUrl}
          ></iframe>
        </div>
      </div>
    </div>
  );
}