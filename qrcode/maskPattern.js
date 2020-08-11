module.exports = class MaskPattern {
  static Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  static PenaltyScores = {
    N1: 3,
    N2: 3,
    N3: 40,
    N4: 10
  };
  // 返回指定位置的掩码
  static getMaskAt(maskPattern, i, j) {
    switch (maskPattern) {
      case MaskPattern.Patterns.PATTERN000:
        return (i + j) % 2 === 0;
      case MaskPattern.Patterns.PATTERN001:
        return i % 2 === 0;
      case MaskPattern.Patterns.PATTERN010:
        return j % 3 === 0;
      case MaskPattern.Patterns.PATTERN011:
        return (i + j) % 3 === 0;
      case MaskPattern.Patterns.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case MaskPattern.Patterns.PATTERN101:
        return (i * j) % 2 + (i * j) % 3 === 0;
      case MaskPattern.Patterns.PATTERN110:
        return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
      case MaskPattern.Patterns.PATTERN111:
        return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
    }
  }
  static applyMask(pattern, data) {
    let size = data.size;

    for (let col = 0; col < size; col++) {
      for (let row = 0; row < size; row++) {
        if (data.isReserved(row, col)) continue;
        data.xor(row, col, this.getMaskAt(pattern, row, col));
      }
    }
  }
  // 根本看不懂这是在干什么
  static getPenaltyN1(data) {
    let size = data.size;
    let points = 0;
    let sameCountCol = 0;
    let sameCountRow = 0;
    let lastCol = null;
    let lastRow = null;

    for (let row = 0; row < size; row++) {
      sameCountCol = 0;
      sameCountRow = 0;
      lastCol = null;
      lastRow = null;

      for (let col = 0; col < size; col++) {
        let module = data.get(row, col);
        if (module === lastCol) {
          sameCountCol++;
        } else {
          if (sameCountCol >= 5) {
            points += MaskPattern.PenaltyScores.N1 + (sameCountCol - 5);
          }
          lastCol = module;
          sameCountCol = 1;
        }

        // 行列双向遍历
        module = data.get(col, row);
        if (module === lastRow) {
          sameCountRow++
        } else {
          if (sameCountRow >= 5) {
            points += MaskPattern.PenaltyScores.N1 + (sameCountRow - 5);
          }
          lastRow = module;
          sameCountRow = 1;
        }
      }

      if (sameCountCol >= 5) {
        points += MaskPattern.PenaltyScores.N1 + (sameCountCol - 5);
      }
      if (sameCountRow >= 5) {
        points += MaskPattern.PenaltyScores.N1 + (sameCountRow - 5);
      }
    }

    return points;
  }
  /**
   * 获取每一个2*2的区域 如果全是1或者全是0 point+1
   * 返回point * 3
   */
  static getPenaltyN2(data) {
    let size = data.size;
    let points = 0;

    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        let last = data.get(row, col) + data.get(row, col + 1)
          + data.get(row + 1, col) + data.get(row + 1, col + 1);

        if (last === 4 || last === 0) points++;
      }
    }

    return points * MaskPattern.PenaltyScores.N2;
  }
  /**
   * 0x5D0 => 10111010000
   * 0x05D => 00001011101
   * 找到按照这个顺序的行列数量
   */
  static getPenaltyN3(data) {
    let size = data.size;
    let points = 0;
    let bitsCol = 0;
    let bitsRow = 0;

    for (let row = 0; row < size; row++) {
      bitsCol = 0;
      bitsRow = 0;
      for (let col = 0; col < size; col++) {
        bitsCol = ((bitsCol << 1) & 0x7FF) | data.get(row, col);
        if (col >= 10 && (bitsCol === 0x5D0 || bitsCol === 0x05D)) {
          points++;
        }

        bitsRow = ((bitsRow << 1) & 0x7FF) | data.get(col, row);
        if (col >= 10 && (bitsRow === 0x5D0 || bitsRow === 0x05D)) {
          points++;
        }
      }
    }

    return points * MaskPattern.PenaltyScores.N3;
  }
  static getPenaltyN4(data) {
    let darkCount = 0;
    let modulesCount = data.data.length;
  }
  static getBestMask(data, setupFormatFunc) {
    let numPatterns = Object.keys(MaskPattern.Patterns).length;
    let bestPattern = 0;
    let lowerPenalty = Infinity;

    for (let p = 0; p < numPatterns; p++) {
      setupFormatFunc(p);
      // 异或操作
      MaskPattern.applyMask(p, data);

      // 计算补码
      let penalty = MaskPattern.getPenaltyN1(data)
        + MaskPattern.getPenaltyN2(data)
        + MaskPattern.getPenaltyN3(data)
        + MaskPattern.getPenaltyN4(data);

      // 再次异或相当于撤销
      MaskPattern.applyMask(p, data);

      if (penalty < lowerPenalty) {
        lowerPenalty = penalty;
        bestPattern = p;
      }
    }

    return bestPattern;
  }
}