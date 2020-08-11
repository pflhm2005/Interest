const Utils = require('./utils');
const Mode = require('./mode');
const ECCode = require('./ecc');
const ReedSolomonEncoder = require('./reedSolomonEncoder');
const BitBuffer = require('./bitBuffer');
const Segments = require('./segments');
const Version = require('./version');
const BitMatrix = require('./bitMatrix');
const MaskPattern = require('./maskPattern');

/**
 * 主类
 */
class QRcode {
  /**
   * 使用Reed-Solomon编码字符
   * 这个方法看不懂啊!!!
   */
  createCodewords(bitBuffer, version, errorCorrectionLevel) {
    /**
     * 计算每个group包含block的数
     * @var totalCodewords codewords总数
     * @var ecTotalBlocks 映射的block数
     * @var blocksInGroup2 除不尽的block
     * @var blocksInGroup1 主block数
     * @var totalCodewordsInGroup1 主block的codewords数量
     * @example 以version => 2,errorCorrectionLevel => M为例
     * totalCodewords => 44
     * ecTotalCodewords => 16
     * dataTotalCodewords => 44 - 16 => 28
     * ecTotalBlocks => 1
     * @result
     * blocksInGroup2 => 0
     * blocksInGroup1 => 1
     * totalCodewordsInGroup1 => 44
     * dataCodewordsInGroup1 => 28
     * dataCodewordsInGroup2 => 29
     * ecCount => 16
     */
    let totalCodewords = Utils.getSymbolTotalCodewords(version);
    let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    let dataTotalCodewords = totalCodewords - ecTotalCodewords;

    let ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);

    let blocksInGroup2 = totalCodewords % ecTotalBlocks;
    let blocksInGroup1 = ecTotalBlocks - blocksInGroup2;

    let totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);

    let dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
    // ???
    let dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;

    // 纠错code数量
    let ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
    // ???
    let rs = new ReedSolomonEncoder(ecCount);

    let offset = 0;
    let dcData = new Array(ecTotalBlocks);
    let ecData = new Array(ecTotalBlocks);
    // 这玩意是个憨憨
    let maxDataSize = 0;
    // 简单讲就是转为十六进制的buffer数组
    let buffer = Utils.BufferFrom(bitBuffer.buffer);

    /**
     * ecTotalBlocks = blocksInGroup1 + blocksInGroup2 => 1
     * dataCodewordsInGroup1 = (dataTotalCodewords / ecTotalBlocks) | 0 => 28
     * 本例中根本用不到2
     */
    for (let b = 0; b < ecTotalBlocks; b++) {
      let dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
      dcData[b] = buffer.slice(offset, offset + dataSize);
      ecData[b] = rs.encode(dcData[b]);

      offset += dataSize;
      maxDataSize = Math.max(maxDataSize, dataSize);
    }

    /**
     * Create final data
     * 前面是处理了Data 这里将data与error结合
     * 前面的关键步骤看不懂 呜呜呜
     */
    let data = Utils.BufferAlloc(totalCodewords);
    let index = 0;
    // 这个循环遍历dcData并将值弄进data数组中
    for (let i = 0; i < maxDataSize; i++) {
      for (let j = 0; j < ecTotalBlocks; j++) {
        if (i < dcData[j].length) {
          data[index++] = dcData[j][i];
        }
      }
    }

    // 这个循环就是把ecData搞进data里
    for (let i = 0; i < ecCount; i++) {
      for (let j = 0; j < ecTotalBlocks; j++) {
        data[index++] = ecData[j][i];
      }
    }

    return data;
  }
  // 将数据整合到一个buffer数组中
  createData(version, errorCorrectionLevel, segments) {
    let buffer = new BitBuffer();
    segments.forEach((data) => {
      // 4bit存类型
      buffer.put(data.mode.bit, 4);

      // 根据mode和version存数据长度数值
      buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));

      // 数据本身
      data.write(buffer);
    });

    // 这里的计算跟getCapacity一样
    let totalCodewords = Utils.getSymbolTotalCodewords(version);

    let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    let dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;

    // 数据长度+4小于给定长度时 加一个结束标记
    if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
      buffer.put(0, 4);
    }

    // bit长度非8的倍数时 填充0
    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(0);
    }

    // 保证数据长度与给定的容量匹配
    let n = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
    for (let i = 0; i < n; i++) {
      buffer.put(i % 2 ? 0x11 : 0xc, 8);
    }

    return this.createCodewords(buffer, version, errorCorrectionLevel);
  }
  createSymbol(data, errorCorrectionLevel, maskPattern) {
    let segments = null;
    // 暂时不处理Array类型的data
    {
      let Seg = new Segments(data);
      // 获取未优化数据所需version
      let rawSegments = Seg.RawSplit();
      let estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
      // 生成优化数据
      segments = Seg.fromString(estimatedVersion || 40);
    }
    // 根据优化的segments再确定一次version
    let version = Version.getBestVersionForData(segments, errorCorrectionLevel);
    // 返回data与error混合的buffer数组
    let dataBits = this.createData(version, errorCorrectionLevel, segments);

    /**
     * 开始生成二维码矩阵模型
     * 矩阵大小为version * 4 + 17
     */
    let moduleCount = Utils.getSymbolSize(version);
    let modules = new BitMatrix(moduleCount);

    /**
     * 添加函数模块(?英文就这么写的 反正函数名说明一切)
     * 这部分内容与data无关 有详细注释
     */
    this.setupFinderPattern(modules, version);
    this.setupTimingPattern(modules);
    this.setupAlignmentPattern(modules, version);

    // 注释写着这里是预先格式化某些区域 防止被mask污染
    this.setupFormatInfo(modules, errorCorrectionLevel, 0);
    if (version >= 7) {
      this.setupVersionInfo(modules, version);
    }

    this.setupData(modules, dataBits);

    if (isNaN(maskPattern)) {
      maskPattern = MaskPattern.getBestMask(modules, this.setupFormatInfo.bind(null, modules, errorCorrectionLevel));
    }

    MaskPattern.applyMask(maskPattern, modules);

    this.setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
    return { modules, version, errorCorrectionLevel, maskPattern, segments };
  }
  /**
   * 已知[r, c]范围是[-1, 7] 则满足条件的所有[r, c]组合如下
   * [0 ~ 6, 0], [0 ~ 6, 6]
   * [0, 0 ~ 6], [6, 0 ~ 6]
   * [2 ~ 4, 2 ~ 4]
   * 若无视pos 在7 * 7的矩阵图如下
   * 
   *       * * * * * * * 
   *       *           * 
   *       *   * * *   * 
   *       *   * * *   * 
   *       *   * * *   * 
   *       *           * 
   *       * * * * * * * 
   * 
   * 就是二维码左上右上左下那个正方形
   */
  setupFinderPattern(matrix, version) {
    /**
     * 花里胡哨一套套
     * @param size 矩阵尺寸
     * @param pos 偏移数组
     */
    let size = matrix.size;
    let pos = Utils.getFinderPatternPosition(version);

    for (let i = 0; i < pos.length; i++) {
      // 第一轮总是0
      let row = pos[i][0];
      let col = pos[i][1];

      // -1有个鸡儿用?
      for (let r = -1; r <= 7; r++) {
        let R = row + r;
        // 越界检测
        if (R <= -1 || R >= size) continue;
        for (let c = -1; c <= 7; c++) {
          let C = col + c;
          if (C <= -1 || C >= size) continue;
          if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix.set(R, C, true, true);
          } else {
            matrix.set(R, C, false, true);
          }
        }
      }
    }
  }
  /**
   * 以version2为例 size => 25
   * [8 ~ 16的偶数, 6], [6, 8 ~ 16的偶数]
   * 图形如下
   *     左上角                           右上角
   *     *           *                       *           *
   *     * * * * * * *   *   *  ...  *   *   * * * * * * *
   *                 
   *                 *
   *                 ...
   * 
   *                 *
   * 
   *     * * * * * * *
   *     *           *
   *     左下角
   */
  setupTimingPattern(matrix) {
    let size = matrix.size;
    for (let r = 8; r < size - 8; r++) {
      // 偶数为true
      let value = r % 2 === 0;
      matrix.set(r, 6, value, true);
      matrix.set(6, r, value, true);
    }
  }
  /**
   * 这里也是可以枚举的 满足条件的[r, c]如下
   * [-2, -2 ~ 2]
   * [-1, -2], [-1, 2]
   * [0, -2], [0, 0], [0, 2]
   * [1, -2], [1, 2]
   * [2. -2 ~ 2]
   * 低version情况返回的pos为[size - 7, size -7]
   * 可以看出这个作用在右下角 中心点为pos 图形如下
   * 
   *           * * * * *
   *           *       *
   *           *   *   *
   *           *       *
   *           * * * * *
   * 
   * 即以不同的pos为中心 生成一系列小正方形
   */
  setupAlignmentPattern(matrix, version) {
    /**
     * version1 返回空
     * version2 ~ 6 返回[size - 7, size - 7]
     * 以及其他更复杂返回
     */
    let pos = Utils.getAlignmentPatternPosition(version);

    for (let i = 0; i < pos.length; i++) {
      let row = pos[i][0];
      let col = pos[i][1];

      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          if (r === -2 || r === 2 || c === -2 || c === 2 ||
            (r === 0 && c === 0)) {
            matrix.set(row + r, col + c, true, true);
          } else {
            matrix.set(row + r, col + c, false, true);
          }
        }
      }
    }
  }
  /**
   * 添加版本信息
   * 影响8行8列的值
   */
  setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
    let size = matrix.size;
    // maskPattern为0时返回G15_MASK
    // 1 << (1,4,10,12,14)
    let bits = Utils.getEncodedBits(errorCorrectionLevel, maskPattern);

    let mod = null;
    /**
     * 可枚举 循环中命中的坐标为
     * [0 ~ 5, 8], [7, 8], [8, 8], [size - 7 ~ size - 1, 8]
     * [8, 0 ~ 5], [8, 7], [8, size - 8 ~ size - 1]
     */
    for (let i = 0; i < 15; i++) {
      mod = ((bits >> i) & 1) === 1;
      // vertical
      if (i < 6) {
        matrix.set(i, 8, mod, true);
      } else if (i < 8) {
        matrix.set(i + 1, 8, mod, true);
      } else {
        matrix.set(size - 15 + i, 8, mod, true);
      }

      // horizontal
      if (i < 8) {
        matrix.set(8, size - i - 1, mod, true);
      } else if (i < 9) {
        matrix.set(8, 15 - i - 1 + 1, mod, true);
      } else {
        matrix.set(8, 15 - i - 1, mod, true);
      }
    }

    matrix.set(size - 8, 8, 1, true);
  }
  /**
   * 暂时用不上
   */
  setupVersionInfo() { }
  /**
   * 数据接入
   * @param matrix 矩阵
   * @param data 数据Buffer数组
   * 结构 => (数据类型 + 数据长度 + 数据内容) * n + 结束符号 + ReedSolomonEncode后的数据
   */
  setupData(matrix, data) {
    let size = matrix.size;
    let inc = -1;
    let row = size - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    /**
     * 数据的注入是右下角开始的 [size - 1, size -1]
     * 以version2为例 矩阵大小为25 * 25
     * 以[24, 24] => [24, 23] => [23, 24] => [23, 23]依次注入数据
     * 即
     * 11  10   9 (保留区域)
     * 13  12   8     7
     * 15  14   6     5
     * 17  16   4     3
     * 19  18   2     1(右下角)
     * 当遇到保留区域会跳过
     * 数据注入流动如上所示
     */
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      // while中的col不变
      while (true) {
        // c => [0 , 1] col - c 表示右左顺序存储数据
        for (let c = 0; c < 2; c++) {
          /**
           * 只有非保留区域才设值
           * 这块逻辑比较简单 就是依次从buffer取值
           */
          if (!matrix.isReserved(row, col - c)) {
            let dark = false;

            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
            }

            matrix.set(row, col - c, dark);
            bitIndex--;

            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }

        row += inc;
        // 从下往上会走row < 0 反正走size <= row
        // 贪食蛇的路线
        if (row < 0 || size <= row) {
          // 重置为0或24
          row -= inc;
          // 1或-1
          inc = -inc;
          break;
        }
      }
    }
  }
}

let str = 'www.baI123du.com';
new QRcode().createSymbol(str, 'M');