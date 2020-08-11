/**
 * codewords的buffer
 * @constructor buffer 以二进制排列的元数据 数值毫无意义
 * @constructor length bit数而非数组长度
 */
module.exports = class BitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  get(index) {
    let bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
  }
  /**
   * 将指定字符加入buffer
   * @param {Number} num 字符的值
   * @param {Number} length 位数
   */
  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  getLengthInBits() {
    return this.length;
  }
  /**
   * 这方法真是个憨憨
   * @param {Boolean} bit
   */
  putBit(bit) {
    let bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    /**
     * @example 类型为BYTE
     * value => 1 << 2 => 4
     * length => 4
     * 在put阶段依次传入的是false,true,false,false(0100)
     * 进行位运算时 由于基数是0x80(0b10000000) 第二次进入位运算
     * buffer[0] |= (0x80 >>> 1)
     * 最终结果为64 => 0100(实际数值)0000(补位值)
     */
    if (bit) {
      this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    }
    this.length++
  }
}
