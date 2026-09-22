/**
 * Shrimp class - 完整修正版（钳子精准衔接且不被身体遮挡）
 * @module animals/shrimp/Shrimp
 */

import { Chain } from '../../core/Chain.js';
import { relativeAngleDiff } from '../../utils/geometry.js';

export class Shrimp {
  constructor(origin, scale = 1.0, bodyColor = null, finColor = null) {
    this.scale = scale;
    this.linkSize = Math.round(40 * scale); 
    this.spine = new Chain(origin, 10, this.linkSize, PI / 10);
    this.bodyColor = bodyColor || color(240, 128, 128);
    this.finColor = finColor || color(220, 100, 100);
    this.bodyWidth = [28, 36, 34, 31, 26, 21, 16, 14, 11, 8].map(w => w * scale);
    this.clamp1Color = bodyColor; // 第一节：白色
    this.clamp2Color = bodyColor;   // 第二节
  }

  resolveToPosition(pos) {
    this.spine.resolve(pos, PI / 60);
  }

  resetSpine(pos, headingAngle) {
    for (let i = 0; i < this.spine.joints.length; i++) {
      this.spine.joints[i].x = pos.x - cos(headingAngle) * this.linkSize * i;
      this.spine.joints[i].y = pos.y - sin(headingAngle) * this.linkSize * i;
      this.spine.angles[i] = headingAngle;
    }
  }

  display() {
    const s = this.scale;
    strokeWeight(1.5 * s); 
    stroke(255);

    const j = this.spine.joints;
    const a = this.spine.angles;

    // 计算用于尾扇的动态宽度系数（保留原逻辑）
    const headToTail = relativeAngleDiff(a[0], a[9]);

    // ========== 1. 先画身体（避免覆盖附肢） ==========
    fill(this.bodyColor);
    beginShape();
    for (let i = 0; i < 10; i++) {
      curveVertex(this._getPosX(i, PI / 2, 0), this._getPosY(i, PI / 2, 0));
    }
    curveVertex(this._getPosX(9, PI, 0), this._getPosY(9, PI, 0));
    for (let i = 9; i >= 0; i--) {
      curveVertex(this._getPosX(i, -PI / 2, 0), this._getPosY(i, -PI / 2, 0));
    }
    curveVertex(this._getPosX(0, -PI / 8, 0), this._getPosY(0, -PI / 8, 0));
    curveVertex(this._getPosX(0, 0, 2 * s), this._getPosY(0, 0, 2 * s));
    curveVertex(this._getPosX(0, PI / 8, 0), this._getPosY(0, PI / 8, 0));
    endShape();

    // ========== 2. 钳子（左右对称，精准衔接） ==========
    // 钳子参数
    const len1 = 300 * s;      // 第一节长度
    const w1   = 10 * s;       // 第一节宽度
    const len2 = 50 * s;       // 第二节长度
    const w2   = 20 * s;       // 第二节宽度
    const jointBend = PI / 70;  // 两节之间的弯曲角度
    const baseOffsetDist = this.bodyWidth[2] + 8 * s; // 基部从身体侧向偏移的距离

    // 左侧钳子
    this._drawClamp(
      j[2], a[2],                     // 关节位置和角度
      baseOffsetDist,                  // 偏移距离
      PI / 2,                          // 偏移方向（垂直于身体向外）
      PI / 6,                          // 第一节指向（向外略向前）
      len1, w1,
      jointBend, len2, w2,
      true                             // 左侧标志（用于钳口微调）
    );

    // 右侧钳子（对称）
    this._drawClamp(
      j[2], a[2],
      baseOffsetDist,
      -PI / 2,                         // 偏移方向（垂直身体向外）
      -PI / 6,                         // 第一节指向（向外略向后？可根据喜好调整）
      len1, w1,
      -jointBend, len2, w2,            // 弯曲角取反
      false
    );

    // ========== 3. 头部触角 ==========
    fill(this.finColor);
    push();
    translate(this._getPosX(0, 0, 10 * s), this._getPosY(0, 0, 10 * s));
    rotate(a[0] - PI / 6);
    line(0, 0, 120 * s, 0);
    ellipse(120 * s, 0, 6 * s, 6 * s);
    pop();
    push();
    translate(this._getPosX(0, 0, 10 * s), this._getPosY(0, 0, 10 * s));
    rotate(a[0] + PI / 6);
    line(0, 0, 120 * s, 0);
    ellipse(120 * s, 0, 6 * s, 6 * s);
    pop();

    // ========== 4. 步足 ==========
    for (let i = 2; i < 6; i++) {
      push();
      translate(this._getPosX(i, PI / 3, 0), this._getPosY(i, PI / 3, 0));
      rotate(a[i] - PI / 3);
      ellipse(0, 0, 80 * s, 16 * s);
      pop();
    }
    for (let i = 2; i < 6; i++) {
      push();
      translate(this._getPosX(i, -PI / 3, 0), this._getPosY(i, -PI / 3, 0));
      rotate(a[i] + PI / 3);
      ellipse(0, 0, 80 * s, 16 * s);
      pop();
    }

    // ========== 5. 尾扇 ==========
    beginShape();
    for (let i = 8; i < 10; i++) {
      const tailWidth = 1.2 * headToTail * (i - 7) * (i - 7);
      curveVertex(j[i].x + cos(a[i] - PI / 2) * tailWidth, j[i].y + sin(a[i] - PI / 2) * tailWidth);
    }
    for (let i = 9; i >= 8; i--) {
      const tailWidth = max(-10 * s, min(10 * s, headToTail * 5));
      curveVertex(j[i].x + cos(a[i] + PI / 2) * tailWidth, j[i].y + sin(a[i] + PI / 2) * tailWidth);
    }
    endShape(CLOSE);

    // ========== 6. 眼睛 ==========
    fill(255);
    ellipse(this._getPosX(0, PI / 2, -10 * s), this._getPosY(0, PI / 2, -10 * s), 12 * s, 12 * s);
    ellipse(this._getPosX(0, -PI / 2, -10 * s), this._getPosY(0, -PI / 2, -10 * s), 12 * s, 12 * s);
  }

  /**
   * 绘制一只完整的钳子（两节）
   * @param {p5.Vector} baseJoint   基部关节坐标
   * @param {number}    baseAngle    关节处身体角度
   * @param {number}    offsetDist   偏移距离
   * @param {number}    offsetDir    偏移方向（相对于 baseAngle）
   * @param {number}    seg1Dir      第一节指向（相对于 baseAngle）
   * @param {number}    len1, w1     第一节长、宽
   * @param {number}    bendAngle    第二节相对于第一节的弯曲角
   * @param {number}    len2, w2     第二节长、宽
   * @param {boolean}   isLeft       是否左侧（用于钳口矩形对称）
   */
  _drawClamp(baseJoint, baseAngle, offsetDist, offsetDir, seg1Dir,
             len1, w1, bendAngle, len2, w2, isLeft) {
    const s = this.scale;
    push();

    // 基部位置 = 关节坐标 + 沿 (baseAngle + offsetDir) 方向偏移 offsetDist
    const baseX = baseJoint.x + cos(baseAngle + offsetDir) * offsetDist;
    const baseY = baseJoint.y + sin(baseAngle + offsetDir) * offsetDist;
    translate(baseX, baseY);

    // 第一节：旋转到 seg1Dir，中心在基部
    rotate(baseAngle + seg1Dir);
    fill(this.clamp1Color);
    ellipse(0, 0, len1, w1);

    // 第二节：中心位于第一节末端 (len1/2, 0)
    translate(len1 / 2, 0);
    rotate(bendAngle);  // 第二节相对第一节弯曲
    fill(this.clamp2Color);
    ellipse(0, 0, len2, w2);

    // 钳口矩形：放在第二节末端附近，左右对称微调
    const jawX = len2 / 2 + 5 * s;
    const jawY = isLeft ? -w2 / 4 : w2 / 4;  // 左侧向上偏，右侧向下偏（模拟螯）
    rect(jawX, jawY - w2 / 4, 15 * s, w2 / 2);

    pop();
  }

  debugDisplay() {
    this.spine.display();
  }

  _getPosX(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].x +
           cos(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }

  _getPosY(i, angleOffset, lengthOffset) {
    return this.spine.joints[i].y +
           sin(this.spine.angles[i] + angleOffset) *
           (this.bodyWidth[i] + lengthOffset);
  }
}
