
import React from 'react';
import { 
  Bug, CheckSquare, Target, FileText, Users, Briefcase, Zap, Star, Heart, Flag, Rocket, Layout, 
  Instagram, Layers, Archive, Clock, Wallet, GitFork, Network, PieChart, Home, Inbox, Settings,
  MessageSquare, Video, Image, File as FileIcon, Link, Server, Bot, Hash
} from 'lucide-react';

export const LogoIcon = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <svg 
        viewBox="0 0 591 556" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path 
            fillRule="evenodd" 
            clipRule="evenodd" 
            d="M258.496 1.89275C253.854 4.06275 103.741 154.079 100.093 160.195C96.715 165.856 95.877 169.796 97.064 174.425C97.975 177.979 106.015 186.331 162.085 241.98C225.192 304.612 226.066 305.533 226.031 309.389C225.988 314.136 231.165 308.765 97.522 442.736C45.807 494.576 2.708 538.444 1.746 540.22C0.784002 541.996 -0.00199619 544.356 3.80837e-06 545.464C0.00500381 548.148 3.393 553.587 5.893 554.925C7.303 555.679 56.106 555.921 170.197 555.739C327.472 555.488 332.62 555.421 336.496 553.574C341.547 551.167 477.482 415.888 482.698 408.078C490.728 396.052 493.164 379.215 488.88 365.335C484.82 352.18 481.146 347.921 426.02 292.48C397.583 263.88 373.769 239.451 373.101 238.192C372.432 236.934 372.13 235.132 372.43 234.188C372.73 233.244 422.029 183.436 481.985 123.504C581.696 23.8328 590.996 14.2607 590.996 11.3057C590.996 6.83375 589.33 3.60775 586.006 1.64475C583.407 0.109749 570.673 -0.0182526 422.842 0.00174745C268.346 0.0227474 262.35 0.0917463 258.496 1.89275ZM375.393 155.23C343.99 186.718 317.329 213.778 316.146 215.365C313.408 219.039 313.202 227.274 315.753 231.085C316.711 232.518 347.631 264.132 384.463 301.339C421.295 338.547 451.992 369.999 452.678 371.234C457.278 379.517 449.506 392.537 441.172 390.508C439.437 390.086 421.612 373.081 390.496 342.165C341.937 293.918 300.527 253.019 247.246 200.684C225.076 178.908 217.996 171.374 217.996 169.561C217.996 167.743 226.085 159.206 251.746 133.94C270.309 115.664 286.846 100.113 288.496 99.3838C290.892 98.3248 305.684 98.0498 361.993 98.0188L432.489 97.9798L375.393 155.23ZM271.596 349.878C273.741 351.472 289.833 367.162 307.356 384.744C332.67 410.143 339.091 417.106 338.607 418.63C338.272 419.685 329.785 428.702 319.747 438.668C305.01 453.298 300.726 456.997 297.496 457.878C292.284 459.299 158.28 459.419 154.561 458.005C153.15 457.468 151.996 456.248 151.996 455.292C151.996 453.589 253.71 352.192 258.885 348.737C262.754 346.153 267.11 346.545 271.596 349.878Z" 
            fill="#3337AD"
        />
    </svg>
  );
};

// Data URI of the EXACT same SVG provided by the user for the favicon
export const FAVICON_SVG_DATA_URI = `data:image/svg+xml,%3Csvg width='591' height='556' viewBox='0 0 591 556' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M258.496 1.89275C253.854 4.06275 103.741 154.079 100.093 160.195C96.715 165.856 95.877 169.796 97.064 174.425C97.975 177.979 106.015 186.331 162.085 241.98C225.192 304.612 226.066 305.533 226.031 309.389C225.988 314.136 231.165 308.765 97.522 442.736C45.807 494.576 2.708 538.444 1.746 540.22C0.784002 541.996 -0.00199619 544.356 3.80837e-06 545.464C0.00500381 548.148 3.393 553.587 5.893 554.925C7.303 555.679 56.106 555.921 170.197 555.739C327.472 555.488 332.62 555.421 336.496 553.574C341.547 551.167 477.482 415.888 482.698 408.078C490.728 396.052 493.164 379.215 488.88 365.335C484.82 352.18 481.146 347.921 426.02 292.48C397.583 263.88 373.769 239.451 373.101 238.192C372.432 236.934 372.13 235.132 372.43 234.188C372.73 233.244 422.029 183.436 481.985 123.504C581.696 23.8328 590.996 14.2607 590.996 11.3057C590.996 6.83375 589.33 3.60775 586.006 1.64475C583.407 0.109749 570.673 -0.0182526 422.842 0.00174745C268.346 0.0227474 262.35 0.0917463 258.496 1.89275ZM375.393 155.23C343.99 186.718 317.329 213.778 316.146 215.365C313.408 219.039 313.202 227.274 315.753 231.085C316.711 232.518 347.631 264.132 384.463 301.339C421.295 338.547 451.992 369.999 452.678 371.234C457.278 379.517 449.506 392.537 441.172 390.508C439.437 390.086 421.612 373.081 390.496 342.165C341.937 293.918 300.527 253.019 247.246 200.684C225.076 178.908 217.996 171.374 217.996 169.561C217.996 167.743 226.085 159.206 251.746 133.94C270.309 115.664 286.846 100.113 288.496 99.3838C290.892 98.3248 305.684 98.0498 361.993 98.0188L432.489 97.9798L375.393 155.23ZM271.596 349.878C273.741 351.472 289.833 367.162 307.356 384.744C332.67 410.143 339.091 417.106 338.607 418.63C338.272 419.685 329.785 428.702 319.747 438.668C305.01 453.298 300.726 456.997 297.496 457.878C292.284 459.299 158.28 459.419 154.561 458.005C153.15 457.468 151.996 456.248 151.996 455.292C151.996 453.589 253.71 352.192 258.885 348.737C262.754 346.153 267.11 346.545 271.596 349.878Z' fill='%233337AD'/%3E%3C/svg%3E`;

export const DynamicIcon = ({ name, className = "", size = 18 }: { name: string, className?: string, size?: number }) => {
    const props = { size, className };
    
    // Explicit mapping to ensure correct icon rendering
    switch (name) {
      case 'Bug': return <Bug {...props} />;
      case 'CheckSquare': return <CheckSquare {...props} />;
      case 'Target': return <Target {...props} />;
      case 'FileText': return <FileText {...props} />;
      case 'Users': return <Users {...props} />;
      case 'Briefcase': return <Briefcase {...props} />;
      case 'Zap': return <Zap {...props} />;
      case 'Star': return <Star {...props} />;
      case 'Heart': return <Heart {...props} />;
      case 'Flag': return <Flag {...props} />;
      case 'Rocket': return <Rocket {...props} />;
      case 'Layout': return <Layout {...props} />;
      case 'Instagram': return <Instagram {...props} />;
      case 'Layers': return <Layers {...props} />;
      case 'Archive': return <Archive {...props} />;
      case 'Clock': return <Clock {...props} />;
      case 'Wallet': return <Wallet {...props} />;
      case 'GitFork': return <GitFork {...props} />;
      case 'Network': return <Network {...props} />;
      case 'PieChart': return <PieChart {...props} />;
      case 'Home': return <Home {...props} />;
      case 'Inbox': return <Inbox {...props} />;
      case 'Settings': return <Settings {...props} />;
      case 'MessageSquare': return <MessageSquare {...props} />;
      case 'Video': return <Video {...props} />;
      case 'Image': return <Image {...props} />;
      case 'File': return <FileIcon {...props} />;
      case 'Link': return <Link {...props} />;
      case 'Server': return <Server {...props} />;
      case 'Bot': return <Bot {...props} />;
      case 'Megaphone': return <span className={`text-[${size}px] font-bold`}>📣</span>; // Fallback if icon missing
      default: return <Hash {...props} />; // Default generic icon
    }
};
