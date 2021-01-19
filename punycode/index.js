class Punycode {
  /**
   * 将字符串的格式由UCS-2统一转换为UTF-16
   * 见https://mathiasbynens.be/notes/javascript-encoding
   */
  ucs2decode(string) {
    const output = [];
    let counter = 0;
    const length = string.length;
    while(counter < length) {
      const value = string.charCodeAt(counter++);
      if (value >= 0xd800 && value <= 0xdbff && counter < length) {
        const extra = string.charCodeAt(counter++);
        if ((extra & 0xfc00) === 0xdc00) {
          output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000); 
        } else {
          output.push(value);
          couter--;
        }
      } else {
        output.push(value);
      }
    }

    return output;
  }
  encode(input) {
    let output = [];

    input = this.ucs2decode(input);

    let inputLength = input.length;

    let n = initialN;
    let delta = 0;
    let bias = initialBias

    // 把常规字符放进output中
    for(const currentValue of input) {
      if (currentValue < 0x80) {
        output.push(String.fromCharCode(currentValue));
      }
    }

    let basicLength = output.length;
    let handledCPCount = basicLength;

    if (basicLength) {
      output.push(delimiter);
    }

    while(handledCPCount < inputLength) {

    }

    return output.join('');
  }
}