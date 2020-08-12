import Utils from './utils';

let EXP_TABLE = Utils.BufferAlloc(512);
let LOG_TABLE = Utils.BufferAlloc(256);

{
  let x = 1;
  /**
   * EXP_TABLE => [1, 2, 4, 8, ...]
   * LOG_TABLE => [0, 0, 1, 0, 2, ...]
   */
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;

    x <<= 1;
    /**
     * 0x100 => 100000000 即大于256
     * 0x11D => 100011101 大于256的值进行异或计算
     *
     */
    if (x & 0x100) {
      x ^= 0x11D;
    }
  }

  // 复制0 ~ 254到255 ~ 511
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
}

/**
 * galois-field
 */
class GF {
  static log(n) {
    return LOG_TABLE[n];
  }
  static exp(n) {
    return EXP_TABLE[n];
  }
  static mul(x, y) {
    if (x === 0 || y === 0) return 0;

    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
  }
}

class Polynomial {
  static mul(p1, p2) {
    let coeff = Utils.BufferAlloc(p1.length + p2.length - 1);

    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        coeff[i + j] ^= GF.mul(p1[i], p2[j]);
      }
    }

    return coeff;
  }
  static mod(divident, divisor) {
    let result = Utils.BufferFrom(divident);

    while ((result.length - divisor.length) >= 0) {
      let coeff = result[0];

      for (let i = 0; i < divisor.length; i++) {
        result[i] ^= GF.mul(divisor[i], coeff);
      }

      let offset = 0;
      while(offset < result.length && result[offset] === 0) offset++;
      result = result.slice(offset);
    }

    return result;
  }
  static generateECPolynomial(degree) {
    let poly = Utils.BufferFrom([1]);
    for (let i = 0; i < degree; i++) {
      poly = Polynomial.mul(poly, [1, GF.exp(i)]);
    }

    return poly;
  }
}

module.exports = class ReedSolomonEncoder {
  constructor(degree) {
    this.genPoly = undefined;
    this.degree = degree;

    if (this.degree) this.initialize(this.degree);
  }
  initialize(degree) {
    this.degree = degree;
    this.genPoly = Polynomial.generateECPolynomial(this.degree);
  }
  encode(data) {
    let pad = Utils.BufferAlloc(this.degree);
    let paddedData = Buffer.concat([data, pad], data.length + this.degree);

    let remainder = Polynomial.mod(paddedData, this.genPoly);

    let start = this.degree - remainder.length;
    if (start > 0){
      let buff = Utils.BufferAlloc(this.degree);
      remainder.copy(buff, start);

      return buff;
    }
    return remainder;
  }
}