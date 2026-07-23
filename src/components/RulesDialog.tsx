import { X } from "@phosphor-icons/react";

export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <header>
          <div>
            <span>活动说明</span>
            <h2 id="rules-title">Bingo游戏规则 · 仔细看</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭规则">
            <X size={22} />
          </button>
        </header>

        <div className="rules-content">
          <section>
            <h3><b>1</b> 保存 Bingo 方格图</h3>
            <p>我将在下一条消息发送 5×5 Bingo方格图，请大家长按保存到手机相册。</p>
            <ul>
              <li>普通格子（白色底）：可填写营员、辅导员、工作人员的昵称。</li>
              <li>特殊格子（蓝色底，共5个）：只能填写工作人员或辅导员的昵称，且必须通过与他们私聊或群聊确认答案后才能填入。</li>
            </ul>
          </section>

          <section>
            <h3><b>2</b> 每格填写“是”和“否”</h3>
            <p>每个格子下方都有“是”和“否”两个空位，你需要分别找到：</p>
            <ul>
              <li>一位对该爱好回答“有兴趣”的人，填入“是”空；</li>
              <li>一位对该爱好回答“没兴趣”的人，填入“否”空。</li>
              <li>对于蓝色特殊格子，你必须向对应的工作人员或辅导员本人核实他们的问卷答案，再填入相应空位。</li>
            </ul>
          </section>

          <section>
            <h3><b>3</b> 寻找同频好友</h3>
            <p>通过群聊、@人、私聊（建议群里互动更热闹）寻找符合条件的人，务必确认对方问卷答案与你填写的“是/否”一致。</p>
          </section>

          <section>
            <h3><b>4</b> 完成一条线</h3>
            <p>当你横向、纵向或对角线任意一条线上的5个格子的所有“是”和“否”空位都被填满（即该线所有名字），截图你的格子图，并填写收集问卷（填入截图和你的姓名）。</p>
            <p className="rule-warning">注意：五个蓝色格子连成的那一条对角线不算入成绩，需要避开选择其他线。</p>
          </section>

          <section>
            <h3><b>5</b> 排名与奖品</h3>
            <ul>
              <li>按先完成一条线并提交问卷的先后顺序，前三名（仅限营员）赢取纪念玩偶。</li>
              <li>所有参与者（包括工作人员和辅导员）均可领取参与奖，工作人员和辅导员不参与前三名排名。</li>
            </ul>
          </section>

          <section>
            <h3><b>6</b> 准度门槛</h3>
            <ul>
              <li>我们将检查你填写的名字，与问卷原始答案比对，计算准确率。</li>
              <li>准确率必须达到80%或以上，成绩方为有效。若低于80%，则名次自动顺延（例如第三名不达标，则第四名营员递补为第三名，以此类推）。</li>
            </ul>
          </section>

          <section>
            <h3><b>7</b> 姓名不得重复</h3>
            <p>同一个人的名字可以出现在不同格子里，但不能在同一行、同一列或同一条对角线的“是”或“否”空位中重复出现，即同一条线上同一人最多出现一次。</p>
          </section>
        </div>

        <footer>
          <button type="button" className="primary-button" onClick={onClose}>我已了解规则</button>
        </footer>
      </section>
    </div>
  );
}
