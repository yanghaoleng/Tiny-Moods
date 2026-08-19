self.onmessage = (event) => {
  const {id, buffer, width, height} = event.data;
  const data = new Uint8ClampedArray(buffer);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const isWhite = (pixel) => {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return Math.min(red, green, blue) >= 232 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 34;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isWhite(pixel)) return;
    visited[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (visited[pixel]) data[pixel * 4 + 3] = 0;
  }
  self.postMessage({id, buffer: data.buffer, width, height}, [data.buffer]);
};
