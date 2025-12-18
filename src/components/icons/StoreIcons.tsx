import steamLogo from '../../assets/stores/steam.svg';
import epicLogo from '../../assets/stores/epic.svg';
import gogLogo from '../../assets/stores/gog.svg';

export function SteamIcon() {
  return <img src={steamLogo} alt="Steam" className="store-icon" />;
}

export function EpicIcon() {
  return <img src={epicLogo} alt="Epic Games" className="store-icon" />;
}

export function GOGIcon() {
  return <img src={gogLogo} alt="GOG" className="store-icon" />;
}
