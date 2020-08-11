const Mode = require('./mode');
const Utils = require('./utils');
const ECCode = require('./ecc');

/**
* Version类
* 关于bit数、errorCorrectionLevel、version之间的对应有个图表
*/
module.exports = class Version {
 // 数据保留位
 static getReservedBitsCount(mode, version) {
   // Character count indicator + mode indicator bits
   return Mode.getCharCountIndicator(mode, version) + 4;
 }
 // 计算数据所需要的的bit数 包括数据本身的bit长度与预留长度
 static getTotalBitsFromDataArray(segments, version) {
   let totalBits = 0;
   segments.forEach(data => {
     let reservedBits = Version.getReservedBitsCount(data.mode, version);
     totalBits += reservedBits + data.getBitsLength();
   });

   return totalBits;
 }
 // 获取version + errorCorrectionLevel对应的bit容量
 static getCapacity(version, errorCorrectionLevel, mode) {
   if (!mode) mode = Mode.BYTE;
   // 获取对应version的codewords总数
   let totalCodewords = Utils.getSymbolTotalCodewords(version);
   // 获取error correction codewords总数
   let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
   // 获取data codewords的bit数
   let dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
   // 混合模式下 直接返回version与errorCorrectionLevel映射的容量大小
   if (mode === Mode.MIXED) return dataTotalCodewordsBits;

   let usableBits = dataTotalCodewordsBits - Version.getReservedBitsCount(mode, version);

   switch (mode) {
     case Mode.NUMERIC:
       return Math.floor((usableBits / 10) * 3);
     case Mode.ALPHANUMERIC:
       return Math.floor((usableBits / 11) * 2);
     case Mode.BYTE:
     default:
       return Math.floor(usableBits / 8);
   }
 }
 // 多数据的version选择 取值范围为1-40
 static getBestVersionForMixedData(segments, errorCorrectionLevel) {
   for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
     let len = Version.getTotalBitsFromDataArray(segments, currentVersion);
     if (len <= Version.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
       return currentVersion;
     }
   }

   // 实际上这里直接返回40就好了
   return undefined;
 }
 // 单数据的version选择
 static getBestVersionForDataLength(mode, len, errorCorrectionLevel) {
   for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
     if (len <= Version.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
       return currentVersion;
     }
   }

   return undefined;
 }
 static getBestVersionForData(data, errorCorrectionLevel) {
   let seg = null;
   let ecl = errorCorrectionLevel || 'M';
   if (Array.isArray(data)) {
     if (data.length > 1) {
       return Version.getBestVersionForMixedData(data, ecl);
     }

     if (data.length === 0) {
       return 1;
     }

     seg = data[0];
   } else {
     seg = data;
   }
   return Version.getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
 }
}