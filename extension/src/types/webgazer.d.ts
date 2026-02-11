declare module "webgazer" {
  interface WebGazer {
    setRegression(type: string): WebGazer;
    setGazeDot(show: boolean): WebGazer;
    showVideoPreview(show: boolean): WebGazer;
    showPredictionPoints(show: boolean): WebGazer;
    showFaceOverlay(show: boolean): WebGazer;
    showFaceFeedbackBox(show: boolean): WebGazer;
    setGazeListener(
      callback: (
        data: { x: number; y: number } | null,
        timestamp: number,
      ) => void,
    ): WebGazer;
    begin(): Promise<WebGazer>;
    end(): void;
    pause(): void;
    resume(): Promise<WebGazer>;
    recordScreenPosition(x: number, y: number, eventType: string): void;
    clearData(): void;
    isReady(): boolean;
    getCurrentPrediction(): Promise<{ x: number; y: number } | null>;
  }

  const webgazer: WebGazer;
  export default webgazer;
}
