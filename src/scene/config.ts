// Shape of data/scene.json: camera presets, board sizes and greybox colors.

export interface CameraPreset {
  azimuthDeg: number;
  elevationDeg: number;
  zoom: number;
}

export interface SceneConfig {
  camera: { active: string; presets: Record<string, CameraPreset>; marginTiles: number };
  board: { tileWidth: number; tileDepth: number; tileHeight: number; baseHeight: number };
  render: { maxPixelRatio: number };
  animation: { hopMs: number; diceMs: number };
  colors: {
    background: string;
    board: string;
    tile: string;
    tileText: string;
    house: string;
    hotel: string;
    dice: string;
    pip: string;
    groups: Record<string, string>;
    players: string[];
  };
  groupSymbols: Record<string, string>;
}
