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
    palette: Record<string, string>;
    background: string;
    board: string;
    boardRim: string;
    tile: string;
    tileEdge: string;
    tileText: string;
    house: string;
    houseRoof: string;
    hotel: string;
    dice: string;
    pip: string;
    shadow: string;
    groups: Record<string, string>;
    players: string[];
  };
  lighting: { skyColor: string; groundColor: string; hemiIntensity: number; sunColor: string; sunIntensity: number; sunPosition: [number, number, number]; shadowOpacity: number };
  // Share of a dressed tile's depth kept for its text (outer side); buildings use the rest.
  // houseLane: depth at the tile's inner edge (by the board centre) where houses stand, so they
  // never cover text or the landmark.
  dressing: { textShare: number; maxHeight: number; houseLane: number };
  groupSymbols: Record<string, string>;
}
