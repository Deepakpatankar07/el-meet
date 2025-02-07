import React from 'react';

export const VideoPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full w-full bg-background rounded-lg">
      <div className="text-white text-2xl">{"( You )"}</div>
    </div>
  );
};