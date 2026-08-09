import { getAppBusinessProvider } from '../src/lib/db/app-business-provider';

async function runRealChatSessionTests() {
  console.log('🚀 开始验证真实多用户会话持久化、查询与重载功能...');
  const provider = getAppBusinessProvider();

  const testUserId1 = 'test-user-admin-01';
  const testUserName1 = '张所长(自动化测试)';
  const testUserRole1 = 'PROVINCIAL_ADMIN';

  const testUserId2 = 'test-user-expert-02';
  const testUserName2 = '李专家(自动化测试)';
  const testUserRole2 = 'CITY_EXPERT';

  // 1. 清理已有测试数据
  await provider.clearUserChatSessions(testUserId1);
  await provider.clearUserChatSessions(testUserId2);

  // 2. 创建用户1的会话 A
  const sessionA = await provider.createChatSession({
    session_id: `test_sess_A_${Date.now()}`,
    user_id: testUserId1,
    user_name: testUserName1,
    user_role: testUserRole1,
    title: '郑州市金水区白纹伊蚊暴发深度研判',
    last_generative_view: {
      type: 'SPATIAL_EARLY_WARNING_MAP',
      city: '郑州市',
      severity: 'red',
      alertsCount: 3
    },
    is_pinned: 1,
    initialMessages: [
      {
        message_id: `msg_1_${Date.now()}`,
        session_id: '',
        sender: 'user',
        text: '请研判金水区白纹伊蚊密度及抗药性情况',
        timestamp: '10:00'
      },
      {
        message_id: `msg_2_${Date.now()}`,
        session_id: '',
        sender: 'agent',
        text: '已调取郑州市金水区时空监测数据，当前 BI 指数达到 48.5，属严重超标。',
        skill_used: '时空预警研判',
        generative_view_snapshot: {
          type: 'SPATIAL_EARLY_WARNING_MAP',
          city: '郑州市',
          severity: 'red'
        },
        timestamp: '10:01'
      }
    ]
  });
  console.log('✅ 会话 A 创建成功:', sessionA.session_id, '初始消息数:', sessionA.message_count);

  // 3. 创建用户1的会话 B
  const sessionB = await provider.createChatSession({
    session_id: `test_sess_B_${Date.now()}`,
    user_id: testUserId1,
    user_name: testUserName1,
    user_role: testUserRole1,
    title: '安阳市汤阴县蜱虫携病核酸检测追踪',
    last_generative_view: {
      type: 'PATHOGEN_HOTSPOT_MAP',
      city: '安阳市'
    },
    is_pinned: 0
  });
  console.log('✅ 会话 B 创建成功:', sessionB.session_id);

  // 4. 创建用户2的会话 C (用户隔离测试)
  const sessionC = await provider.createChatSession({
    session_id: `test_sess_C_${Date.now()}`,
    user_id: testUserId2,
    user_name: testUserName2,
    user_role: testUserRole2,
    title: '信阳市恙螨种群动态预测',
    is_pinned: 0
  });
  console.log('✅ 用户2 会话 C 创建成功:', sessionC.session_id);

  // 5. 验证用户隔离查询
  const user1Sessions = await provider.getChatSessions({ userId: testUserId1 });
  console.log(`✅ 用户1 查询到 ${user1Sessions.length} 条会话 (预期: 2)`);
  if (user1Sessions.length !== 2) throw new Error('用户1 会话数不匹配');

  const user2Sessions = await provider.getChatSessions({ userId: testUserId2 });
  console.log(`✅ 用户2 查询到 ${user2Sessions.length} 条会话 (预期: 1)`);
  if (user2Sessions.length !== 1) throw new Error('用户2 会话数不匹配');

  // 6. 验证关键词搜索 (模糊匹配标题或消息文本)
  const searchByKeyword = await provider.getChatSessions({ userId: testUserId1, keyword: '白纹伊蚊' });
  console.log(`✅ 关键词"白纹伊蚊"检索到 ${searchByKeyword.length} 条会话 (预期: 1)`);
  if (searchByKeyword.length !== 1 || searchByKeyword[0].session_id !== sessionA.session_id) {
    throw new Error('关键词检索异常');
  }

  // 7. 验证会话消息追加与工作台视图快照更新
  await provider.batchAppendChatMessages(
    sessionA.session_id,
    [
      {
        message_id: `msg_3_${Date.now()}`,
        session_id: sessionA.session_id,
        sender: 'user',
        text: '针对该区域推荐消杀药剂与配比方案',
        timestamp: '10:05'
      },
      {
        message_id: `msg_4_${Date.now()}`,
        session_id: sessionA.session_id,
        sender: 'agent',
        text: '推荐使用 2.5% 高效氯氟氰菊酯超低容量喷雾，建议稀释比例 1:50。',
        skill_used: '抗药性与用药研判',
        generative_view_snapshot: {
          type: 'PESTICIDE_RESISTANCE_MATRIX',
          recommendation: '2.5%高效氯氟氰菊酯'
        },
        timestamp: '10:06'
      }
    ],
    {
      type: 'PESTICIDE_RESISTANCE_MATRIX',
      recommendation: '2.5%高效氯氟氰菊酯'
    }
  );

  // 8. 验证重新加载会话 (Reload & Resume)
  const reloadedSession = await provider.getChatSessionById(sessionA.session_id);
  const reloadedMessages = await provider.getChatMessages(sessionA.session_id);
  console.log(`✅ 重新加载会话 A: 消息总数 ${reloadedMessages.length} (预期: 4)`);
  console.log('✅ 重新加载工作台快照类型:', reloadedSession?.last_generative_view?.type);

  if (reloadedMessages.length !== 4) throw new Error('重载后消息数量不正确');
  if (reloadedSession?.last_generative_view?.type !== 'PESTICIDE_RESISTANCE_MATRIX') {
    throw new Error('工作台视图快照还原不正确');
  }

  // 9. 验证会话重命名与置顶修改
  await provider.updateChatSession(sessionA.session_id, {
    title: '【重点关注】金水区伊蚊与用药研判',
    is_pinned: 0
  });
  const updatedSessionA = await provider.getChatSessionById(sessionA.session_id);
  console.log('✅ 修改后标题:', updatedSessionA?.title, '置顶:', updatedSessionA?.is_pinned);
  if (updatedSessionA?.title !== '【重点关注】金水区伊蚊与用药研判' || updatedSessionA?.is_pinned !== 0) {
    throw new Error('会话更新异常');
  }

  // 10. 验证删除与清空
  await provider.deleteChatSession(sessionB.session_id);
  const remainingUser1 = await provider.getChatSessions({ userId: testUserId1 });
  console.log(`✅ 删除会话 B 后用户1 剩余会话数: ${remainingUser1.length} (预期: 1)`);
  if (remainingUser1.length !== 1) throw new Error('单条删除异常');

  await provider.clearUserChatSessions(testUserId1);
  await provider.clearUserChatSessions(testUserId2);
  const clearedUser1 = await provider.getChatSessions({ userId: testUserId1 });
  console.log(`✅ 全部清空后用户1 会话数: ${clearedUser1.length} (预期: 0)`);
  if (clearedUser1.length !== 0) throw new Error('清空会话异常');

  console.log('🎉 恭喜！多用户历史会话真实持久化、查询、重载与管理测试全部 100% 通过！');
}

runRealChatSessionTests().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
