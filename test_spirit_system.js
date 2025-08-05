// Script test cho hệ thống Linh Thú
const API_BASE_URL = 'http://localhost:5000';

async function testSpiritSystem() {
  console.log('🧪 Bắt đầu test hệ thống Linh Thú...\n');

  try {
    // 1. Test lấy danh sách spirits
    console.log('1. Test lấy danh sách spirits...');
    const spiritsResponse = await fetch(`${API_BASE_URL}/api/spirits`);
    if (spiritsResponse.ok) {
      const spirits = await spiritsResponse.json();
      console.log(`✅ Lấy được ${spirits.length} spirits`);
      spirits.forEach(spirit => {
        console.log(`   - ${spirit.name} (${spirit.rarity}) - ${spirit.stats?.length || 0} stats`);
      });
    } else {
      console.log('❌ Lỗi khi lấy danh sách spirits');
    }

    // 2. Test lấy spirits của user (user_id = 3)
    console.log('\n2. Test lấy spirits của user...');
    const userSpiritsResponse = await fetch(`${API_BASE_URL}/api/users/3/spirits`);
    if (userSpiritsResponse.ok) {
      const userSpirits = await userSpiritsResponse.json();
      console.log(`✅ User có ${userSpirits.length} spirits`);
      userSpirits.forEach(spirit => {
        console.log(`   - ${spirit.name} ${spirit.is_equipped ? '(đang trang bị)' : '(chưa trang bị)'}`);
      });
    } else {
      console.log('❌ Lỗi khi lấy spirits của user');
    }

    // 3. Test lấy spirits của pet (pet_id = 27)
    console.log('\n3. Test lấy spirits của pet...');
    const petSpiritsResponse = await fetch(`${API_BASE_URL}/api/pets/27/spirits`);
    if (petSpiritsResponse.ok) {
      const petSpirits = await petSpiritsResponse.json();
      console.log(`✅ Pet có ${petSpirits.length} spirits đang trang bị`);
      petSpirits.forEach(spirit => {
        console.log(`   - ${spirit.name} (${spirit.rarity})`);
      });
    } else {
      console.log('❌ Lỗi khi lấy spirits của pet');
    }

    // 4. Test trang bị spirit (nếu có spirit chưa trang bị)
    console.log('\n4. Test trang bị spirit...');
    const equipResponse = await fetch(`${API_BASE_URL}/api/spirits/equip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userSpiritId: 1, // ID của user_spirit
        petId: 27
      }),
    });

    if (equipResponse.ok) {
      const result = await equipResponse.json();
      console.log(`✅ ${result.message}`);
    } else {
      const error = await equipResponse.json();
      console.log(`❌ Lỗi khi trang bị: ${error.error}`);
    }

    // 5. Test tháo spirit
    console.log('\n5. Test tháo spirit...');
    const unequipResponse = await fetch(`${API_BASE_URL}/api/spirits/unequip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userSpiritId: 1
      }),
    });

    if (unequipResponse.ok) {
      const result = await unequipResponse.json();
      console.log(`✅ ${result.message}`);
    } else {
      const error = await unequipResponse.json();
      console.log(`❌ Lỗi khi tháo spirit: ${error.error}`);
    }

    console.log('\n🎉 Test hoàn thành!');

  } catch (error) {
    console.error('❌ Lỗi trong quá trình test:', error);
  }
}

// Chạy test nếu file được execute trực tiếp
if (require.main === module) {
  testSpiritSystem();
}

module.exports = { testSpiritSystem }; 