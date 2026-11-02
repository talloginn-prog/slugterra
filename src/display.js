export const MAX_DISPLAY = Object.freeze({ width: 3440, height: 1440 });
export const ASPECT_RATIOS = Object.freeze(['auto', '16:9', '21:9']);
export const RESOLUTIONS = Object.freeze(['auto', '1920x1080', '2560x1080', '3440x1440']);

/** Fit the view without stretching and cap actual GPU pixels, including on Retina screens. */
export function calculateDisplay({ width = 1, height = 1, aspectRatio = 'auto', resolution = 'auto', pixelRatio = 1 } = {}) {
  width = Math.max(1, Number.isFinite(width) ? width : 1);
  height = Math.max(1, Number.isFinite(height) ? height : 1);
  const maximumAspect = MAX_DISPLAY.width / MAX_DISPLAY.height;
  const aspect = aspectRatio === '21:9' ? maximumAspect : aspectRatio === '16:9' ? 16 / 9 : Math.min(width / height, maximumAspect);
  let viewWidth = Math.min(width, MAX_DISPLAY.width), viewHeight = viewWidth / aspect;
  if (viewHeight > Math.min(height, MAX_DISPLAY.height)) { viewHeight = Math.min(height, MAX_DISPLAY.height); viewWidth = viewHeight * aspect; }
  const [renderWidth, renderHeight] = RESOLUTIONS.includes(resolution) && resolution !== 'auto' ? resolution.split('x').map(Number) : [MAX_DISPLAY.width, MAX_DISPLAY.height];
  const ratio = Math.min(Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1, renderWidth / viewWidth, renderHeight / viewHeight, MAX_DISPLAY.width / viewWidth, MAX_DISPLAY.height / viewHeight);
  return { width: viewWidth, height: viewHeight, left: (width - viewWidth) / 2, top: (height - viewHeight) / 2, aspect, pixelRatio: ratio, bufferWidth: Math.floor(viewWidth * ratio), bufferHeight: Math.floor(viewHeight * ratio) };
}
