const defaultOptions = {
  alphaThreshold: 128,
  minimumComponentArea: 4,
  maximumDetachedAreaRatio: 0.08,
  minimumGap: 2,
  edgeMargin: 16,
  allowedRegions: [],
};

export function analyzeFrame(frame, options = {}) {
  validateFrame(frame);
  const config = { ...defaultOptions, ...options };
  const { data, width, height } = frame;
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let index = 0; index < width * height; index += 1) {
    if (
      visited[index] ||
      data[index * 4 + 3] < config.alphaThreshold
    ) {
      continue;
    }
    const stack = [index];
    visited[index] = 1;
    const pixels = [];
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (stack.length > 0) {
      const current = stack.pop();
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (
            nextX < 0 ||
            nextY < 0 ||
            nextX >= width ||
            nextY >= height
          ) {
            continue;
          }
          const next = nextY * width + nextX;
          if (
            visited[next] ||
            data[next * 4 + 3] < config.alphaThreshold
          ) {
            continue;
          }
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
    components.push({
      area: pixels.length,
      minX,
      minY,
      maxX,
      maxY,
      pixels,
    });
  }

  components.sort((left, right) => right.area - left.area);
  const main = components[0];
  if (!main) {
    return { components, mainComponent: undefined, suspiciousComponents: [] };
  }

  const suspiciousComponents = components.slice(1).filter((component) => {
    const areaRatio = component.area / main.area;
    const gap = componentGap(component, main);
    const componentWidth = component.maxX - component.minX + 1;
    const componentHeight = component.maxY - component.minY + 1;
    const aspectRatio = Math.max(
      componentWidth / componentHeight,
      componentHeight / componentWidth,
    );
    const nearEdge =
      component.minX <= config.edgeMargin ||
      component.minY <= config.edgeMargin ||
      component.maxX >= width - 1 - config.edgeMargin ||
      component.maxY >= height - 1 - config.edgeMargin;
    const allowed = config.allowedRegions.some((region) =>
      boxesIntersect(component, {
        minX: region.x,
        minY: region.y,
        maxX: region.x + region.width - 1,
        maxY: region.y + region.height - 1,
      }),
    );
    return (
      !allowed &&
      component.area >= config.minimumComponentArea &&
      areaRatio <= config.maximumDetachedAreaRatio &&
      gap >= config.minimumGap &&
      (nearEdge || aspectRatio >= 4)
    );
  });

  return {
    components,
    mainComponent: main,
    suspiciousComponents,
  };
}

export function sanitizeFrame(frame, options = {}) {
  const analysis = analyzeFrame(frame, options);
  const data = Buffer.from(frame.data);
  for (const component of analysis.suspiciousComponents) {
    for (const pixel of component.pixels) {
      data[pixel * 4] = 0;
      data[pixel * 4 + 1] = 0;
      data[pixel * 4 + 2] = 0;
      data[pixel * 4 + 3] = 0;
    }
  }
  return {
    data,
    width: frame.width,
    height: frame.height,
    removedComponents: analysis.suspiciousComponents,
  };
}

function componentGap(left, right) {
  const horizontal = Math.max(
    0,
    right.minX - left.maxX - 1,
    left.minX - right.maxX - 1,
  );
  const vertical = Math.max(
    0,
    right.minY - left.maxY - 1,
    left.minY - right.maxY - 1,
  );
  return Math.hypot(horizontal, vertical);
}

function boxesIntersect(left, right) {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  );
}

function validateFrame(frame) {
  if (
    !frame ||
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    !frame.data ||
    frame.data.length !== frame.width * frame.height * 4
  ) {
    throw new Error("invalid RGBA frame");
  }
}
