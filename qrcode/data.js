const Mode = require('./mode');
const Utils = require('./utils');

/**
 * 数据类型类
 */
class Data {
  constructor(data) {
    this.data = data;
    if (new.target === Data) {
      throw new Error('invalid constructor');
    }
    this.ClsInstance = new.target;
  }
  getLength() {
    return this.data.length;
  }
  getBitsLength() {
    return this.ClsInstance.getBitsLength(this.data.length);
  }
}

class NumericData extends Data {
  constructor(data) {
    super(data.toString());
    this.mode = Mode.NUMERIC;
  }
  /**
   * 数字类型的内容每三个会被压缩成10bit的内容
   * 若出现单个或两个数字 压缩为4bit、7bit
   * @example
   * 9 => 3 * 10 = 30bit
   * 10 => 3 * 10 + 1 * 3 + 4 = 34bit
   * @return 返回指定长度数字所需要的bit位数
   */
  static getBitsLength(len) {
    return 10 * Math.floor(len / 3) + ((len % 3) ? ((len % 3) * 3 + 1) : 0);
  }
  write(bitBuffer) {
    let i = 0;
    let group = [];
    let value = 0;
    for (; i + 3 <= this.data.length; i += 3) {
      group = this.data.substr(i, 3);
      value = parseInt(group, 10);

      bitBuffer.put(value, 10);
    }

    let n = this.data.length - i;
    if (n > 0) {
      group = this.data.substr(i);
      value = parseInt(group, 10);

      bitBuffer.put(value, n * 3 + 1);
    }
  }
}

const ALPHA_NUM_CHARS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  ' ', '$', '%', '*', '+', '-', '.', '/', ':'
];

class AlphanumericData extends Data {
  constructor(data) {
    super(data);
    this.mode = Mode.ALPHANUMERIC;
  }
  /**
   * 字符类型内容每两个会被压缩为11bit的内容
   * 若出现单个字符 压缩为6bit
   * @example
   * 12 => 11 * 6 = 66bit
   * 13 => 11 * 6 + 6 = 72bit
   * @return 返回指定长度字符所需要的bit位数
   */
  static getBitsLength(len) {
    return 11 * Math.floor(len / 2) + 6 * (len % 2);
  }
  write(bitBuffer) {
    let i = 0;
    for (; i + 2 <= this.data.length; i += 2) {
      /**
       * 这里组合是第一个字符的索引乘以45拼上第二个字符索引
       * 例如AB => 10 * 45 + 11 = 461
       * 双字符11bit
       */
      let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;

      value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);

      bitBuffer.put(value, 11);
    }

    // 单个字符6bit
    if (this.data.length % 2) {
      bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i], 6));
    }
  }
}

class ByteData extends Data {
  constructor(data) {
    super(Utils.BufferFrom(data));
    this.mode = Mode.BYTE;
  }
  /**
   * 1byte = 8bit
   * @return 返回指定字节所需要的bit位数
   */
  static getBitsLength(len) {
    return len * 8;
  }
  write(bitBuffer) {
    let l = this.data.length;
    for (let i = 0; i < l; i++) {
      bitBuffer.put(this.data[i], 8);
    }
  }
}

module.exports = { NumericData, AlphanumericData, ByteData };