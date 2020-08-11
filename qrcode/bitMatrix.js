const Utils = require('./utils');

/**
 * 矩阵类
 * 也就普普通通一维数组
 */
module.exports = class BitMatrix {
  constructor(size) {
    this.size = size;
    this.data = Utils.BufferAlloc(size * size);
    this.reservedBit = Utils.BufferAlloc(size * size);
  }
  set(row, col, value, reserved) {
    let index = row * this.size + col;
    this.data[index] = value;
    if (reserved) this.reservedBit[index] = true;
  }
  get(row, col) {
    return this.data[row * this.size + col];
  }
  xor(row, col, value) {
    this.data[row * this.size + col] ^= value;
  }
  isReserved(row, col) {
    return this.reservedBit[row * this.size + col];
  }
}