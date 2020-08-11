const Utils = require('./utils');
const Mode = require('./mode');
const { NumericData, AlphanumericData, ByteData } = require('./data');

/**
 * 数据分片类
 */
module.exports = class Segments {
  constructor(data) {
    this.data = data;
    this.segs = Utils.splitString(data);
  }
  // 生成单个类型的分片
  buildSingleSegment(data, mode) {
    switch (mode) {
      case Mode.NUMERIC:
        return new NumericData(data);
      case Mode.ALPHANUMERIC:
        return new AlphanumericData(data);
      case Mode.BYTE:
        return new ByteData(data);
    }
  }
  // 将数据二次处理
  fromArray(array) {
    return array.reduce((acc, seg) => {
      if (typeof seg === 'string') {
        acc.push(this.buildSingleSegment(seg, null));
      } else if (seg.data) {
        acc.push(this.buildSingleSegment(seg.data, seg.mode));
      }
      return acc;
    }, []);
  }
  // 返回未优化的数据分片
  RawSplit() {
    return this.fromArray(this.segs);
  }

  /**
   * 一种数据可以有多个类型处理 在这里被展开
   * 例如数字可以被处理为NUMERIC,ALPHANUMERIC,BYTE
   * 万物皆可byte
   */
  buildNodes() {
    let nodes = [];
    for (let i = 0; i < this.segs.length; i++) {
      let seg = this.segs[i];
      switch (seg.mode) {
        case Mode.NUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
            { data: seg.data, mode: Mode.BYTE, length: seg.length },
          ]);
          break;
        case Mode.ALPHANUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.BYTE, length: seg.length },
          ]);
          break;
        case Mode.BYTE:
          nodes.push([seg]);
          break;
      }
    }

    return nodes;
  }
  /**
   * 将nodes重绘成一个图
   * 每一个node指向下一个node时会有一个weight值
   * www.baI123du.com被肢解如下
   * [
   *  [BYTE],                           // www
   *  [ALPHANUMERIC, BYTE],             // .
   *  [BYTE],                           // ba
   *  [ALPHANUMERIC, BYTE],             // I
   *  [NUMERIC, ALPHANUMERIC, BYTE],    // 123
   *  [BYTE],                           // du
   *  [ALPHANUMERIC, BYTE],             // .
   *  [BYTE]                            // com
   * ]
   * 经过计算bits位数 每一个类型都会有一个weight值
   * 1. 每一个新类型都会包含4个bit位的类型标记以及一定的保留位
   * 2. 如果是老类型 则直接累计数据本身的bit位数
   * 3. 由上往下遍历
   */
  buildGraph(nodes, version) {
    let table = {};
    let graph = { 'start': {} };
    let prevNodeIds = ['start'];
    for (let i = 0; i < nodes.length; i++) {
      let nodeGroup = nodes[i];
      let currentNodeIds = [];

      for (let j = 0; j < nodeGroup.length; j++) {
        let node = nodeGroup[j];
        // 二维数组坐标
        let key = '' + i + j;

        currentNodeIds.push(key);
        table[key] = { node, lastCount: 0 };
        graph[key] = {};
        /**
         * 核心循环
         * 第一轮由于NodeId是start而table没有 必走else逻辑
         * 即graph.start['00'] = SegmentBits + 4 + ReservedBits
         * 第一轮循环后 数据结构变成
         * table =>{ '00': node, lastCount: 0 }
         * graph => { 'start':{ '00' : 36 } }
         * prevNodeIds => ['00']
         * 第二轮循环继续遍历prevNodeIds
         * table => { '00': node, lastCount: 2, '10': node, lastCount: 0, '11': node, lastCount: 0 }
         * graph => { ..., '00': { '10': 19, '11': 8 } }
         * prevNodeIdx => ['10', '11']
         * and so on...
         */
        for (let n = 0; n < prevNodeIds.length; n++) {
          let prevNodeId = prevNodeIds[n];
          // 前后节点类型相同 例如www(BYTE) => .(BYTE)
          if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
            // 类型相同 只需要计算合并后的数据与单个数据的bit差值
            graph[prevNodeId][key] = this.getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode)
              - this.getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
            // 这个不知道有什么意义
            table[prevNodeId].lastCount += node.length;
          }
          // 新节点类型 例如www(BYTE) => .(ALPHANUMERIC)
          else {
            // 记录当前节点长度
            if (table[prevNodeId]) {
              table[prevNodeId].lastCount = node.length;
            }
            // 新类型需要额外4位做类型标识以及保留位记录长度
            graph[prevNodeId][key] = this.getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
          }
        }
      }

      prevNodeIds = currentNodeIds;
    }

    for (let i = 0; i < prevNodeIds.length; i++) {
      graph[prevNodeIds[i]]['end'] = 0;
    }

    return { map: graph, table };
  }
  /**
   * 返回不同数据类型的bit长度
   * @param {Number} len 字符长度
   * @param {Mode} mode 数据类型
   * @example input => 123
   * NUMERIC => 10 * 1 => 10
   * ALPHANUMERIC => 11 + 6 => 17
   * BYTE => 3 * 8 => 24
   * @return 指定长度的数据在不同类型下的bit位数
   */
  getSegmentBitsLength(len, mode) {
    switch (mode) {
      case Mode.NUMERIC:
        return NumericData.getBitsLength(len);
      case Mode.ALPHANUMERIC:
        return AlphanumericData.getBitsLength(len);
      case Mode.BYTE:
        return ByteData.getBitsLength(len);
    }
  }
  /**
   * 寻最短路径算法
   */
  find_path(map, dpLen) {
    let result = [];
    let dp = [];
    let iterator = map.start;
    for (let i = 0; i < dpLen; i++) {
      dp[i] = [Infinity, Infinity, Infinity];
    }
    Object.keys(iterator).forEach(pos => {
      dp[pos[0]][pos[1]] = iterator[pos];
    });
    for (let i = 0; i < dpLen; i++) {
      result.push('' + i + '0');
      for (let j = 0; j < 3; j++) {
        let key = '' + i + j;
        if (!map.hasOwnProperty(key)) break;
        iterator = map[key];
        if (iterator.hasOwnProperty('end')) break;
        Object.keys(iterator).forEach(pos => {
          let oldValue = dp[pos[0]][pos[1]];
          let newValue = dp[i][j] + iterator[pos];
          if (newValue < oldValue) {
            result[i] = key;
            dp[pos[0]][pos[1]] = newValue;
          }
        });
      }
    }
    return result;
  }
  // 合并同类型的相邻数据分片
  mergeSegments(segs) {
    return segs.reduce((acc, seg) => {
      let len = acc.length;
      let prevSeg = len ? acc[len - 1] : null;
      if (prevSeg && prevSeg.mode === seg.mode) {
        acc[len - 1].data += seg.data;
        return acc;
      }
      acc.push(seg);
      return acc;
    }, []);
  }
  // 返回优化后的数据分片
  fromString(version) {
    let nodes = this.buildNodes();
    let graph = this.buildGraph(nodes, version);
    let path = this.find_path(graph.map, nodes.length);
    let optimizedSegs = [];
    for (let i = 0; i < path.length; i++) {
      optimizedSegs.push(graph.table[path[i]].node);
    }
    return this.fromArray(this.mergeSegments(optimizedSegs));
  }
}