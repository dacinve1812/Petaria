// Moved from project root -> scripts/ for consistency
const API_BASE_URL = 'http://localhost:5000';

// Test data cho mail hệ thống
const systemMails = [
  {
    subject: "Hoàn thành nhiệm vụ nhận quà",
    content: "Chúc mừng! Bạn đã hoàn thành nhiệm vụ và nhận được phần thưởng. Hãy kiểm tra kho đồ của bạn.",
    sender_name: "Hệ thống",
    attached_rewards: {
      peta: 100,
      peta_gold: 50,
      items: [
        {
          item_id: 47,
          quantity: 1
        }
      ]
    },
    is_read: false,
    is_claimed: false
  },
  {
    subject: "Phần thưởng đăng nhập hàng ngày",
    content: "Bạn đã đăng nhập liên tục 7 ngày! Nhận phần thưởng đặc biệt này.",
    sender_name: "Hệ thống",
    attached_rewards: {
      peta: 200,
      items: [
        {
          item_id: 47,
          quantity: 2
        }
      ]
    },
    is_read: false,
    is_claimed: false
  },
  {
    subject: "Sự kiện đặc biệt - Quà tặng",
    content: "Tham gia sự kiện đặc biệt và nhận quà tặng độc quyền!",
    sender_name: "Ban tổ chức",
    attached_rewards: {
      peta_gold: 100,
      items: [
        {
          item_id: 47,
          quantity: 3
        }
      ]
    },
    is_read: false,
    is_claimed: false
  },
  {
    subject: "Nhiệm vụ tuần hoàn",
    content: "Hoàn thành nhiệm vụ tuần và nhận phần thưởng hấp dẫn.",
    sender_name: "Hệ thống",
    attached_rewards: {
      peta: 150,
      peta_gold: 75,
      items: [
        {
          item_id: 47,
          quantity: 1
        }
      ]
    },
    is_read: false,
    is_claimed: false
  },
  {
    subject: "Quà tặng sinh nhật",
    content: "Chúc mừng sinh nhật! Chúng tôi gửi tặng bạn một món quà đặc biệt.",
    sender_name: "Hệ thống",
    attached_rewards: {
      peta: 500,
      peta_gold: 200,
      items: [
        {
          item_id: 47,
          quantity: 5
        }
      ]
    },
    is_read: false,
    is_claimed: false
  },
  {
    subject: "Thông báo bảo trì",
    content: "Hệ thống sẽ bảo trì vào ngày mai từ 2:00 - 4:00 sáng. Xin lỗi vì sự bất tiện.",
    sender_name: "Ban quản trị",
    attached_rewards: {},
    is_read: false,
    is_claimed: false
  }
];

// Hàm gửi mail test đến user
async function sendTestMailsToUser(userId) {
  console.log(`📧 Đang gửi ${systemMails.length} mail test đến user ${userId}...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < systemMails.length; i++) {
    const mail = systemMails[i];
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/mails/system-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          subject: mail.subject,
          message: mail.content,
          attached_rewards: mail.attached_rewards,
          expire_days: 30
        }),
      });

      if (response.ok) {
        try {
          await response.json();
          console.log(`✅ Mail ${i + 1} gửi thành công: ${mail.subject}`);
          successCount++;
        } catch {
          console.log(`✅ Mail ${i + 1} gửi thành công: ${mail.subject} (không parse được response)`);
          successCount++;
        }
      } else {
        try {
          const errorText = await response.text();
          console.error(`❌ Lỗi gửi mail ${i + 1} (${response.status}):`, errorText);
        } catch {
          console.error(`❌ Lỗi gửi mail ${i + 1} (${response.status}): Không đọc được response`);
        }
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Lỗi kết nối khi gửi mail ${i + 1}:`, error.message);
      errorCount++;
    }
    
    // Delay nhỏ giữa các request
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`🎉 Hoàn thành! Thành công: ${successCount}, Lỗi: ${errorCount}`);
  return { successCount, errorCount };
}

// Hàm gửi mail đến tất cả user
async function sendTestMailsToAllUsers() {
  console.log('📧 Đang gửi mail test đến tất cả user...');
  
  try {
    // Lấy danh sách tất cả user
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'GET',
    });
    
    if (response.ok) {
      try {
        const users = await response.json();
        console.log(`👥 Tìm thấy ${users.length} user, đang gửi mail...`);
        
        let totalSuccess = 0;
        let totalError = 0;
        
        for (const user of users) {
          console.log(`\n📬 Đang gửi mail cho user ${user.id} (${user.username || user.email})...`);
          const result = await sendTestMailsToUser(user.id);
          totalSuccess += result.successCount;
          totalError += result.errorCount;
          
          // Delay giữa các user
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`\n🎉 Tổng kết: Thành công: ${totalSuccess}, Lỗi: ${totalError}`);
      } catch (parseError) {
        console.error('❌ Lỗi parse response users:', parseError);
      }
    } else {
      console.error('❌ Lỗi khi lấy danh sách user:', response.status);
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
  }
}

// Hàm gửi mail đến nhiều user cụ thể
async function sendTestMailsToMultipleUsers(userIds) {
  console.log(`📧 Đang gửi mail test đến ${userIds.length} user...`);
  
  let totalSuccess = 0;
  let totalError = 0;
  
  for (const userId of userIds) {
    console.log(`\n📬 Đang gửi mail cho user ${userId}...`);
    const result = await sendTestMailsToUser(userId);
    totalSuccess += result.successCount;
    totalError += result.errorCount;
    
    // Delay giữa các user
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n🎉 Tổng kết: Thành công: ${totalSuccess}, Lỗi: ${totalError}`);
}

// Hàm xóa tất cả mail của user
async function deleteAllUserMails(userId) {
  console.log(`🗑️ Đang xóa tất cả mail của user ${userId}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/mails/${userId}`, {
      method: 'GET',
    });
    
    if (response.ok) {
      try {
        const mails = await response.json();
        console.log(`📧 Tìm thấy ${mails.length} mail, đang xóa...`);
        
        let deletedCount = 0;
        for (const mail of mails) {
          const deleteResponse = await fetch(`${API_BASE_URL}/api/mails/${mail.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ Đã xóa mail: ${mail.subject}`);
            deletedCount++;
          } else {
            console.error(`❌ Lỗi xóa mail: ${mail.subject} (${deleteResponse.status})`);
          }
        }
        
        console.log(`🎉 Hoàn thành xóa mail! Đã xóa: ${deletedCount}/${mails.length}`);
        return deletedCount;
      } catch (parseError) {
        console.error('❌ Lỗi parse response mails:', parseError);
        return 0;
      }
    } else {
      console.error('❌ Lỗi khi lấy danh sách mail:', response.status);
      return 0;
    }
  } catch (error) {
    console.error('❌ Lỗi khi xóa mail:', error.message);
    return 0;
  }
}

// Hàm hiển thị thông tin mail của user
async function showUserMails(userId) {
  console.log(`📧 Đang lấy thông tin mail của user ${userId}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/mails/${userId}`, {
      method: 'GET',
    });
    
    if (response.ok) {
      try {
        const mails = await response.json();
        console.log(`📬 User ${userId} có ${mails.length} mail:`);
        
        mails.forEach((mail, index) => {
          const rewards = JSON.parse(mail.attached_rewards || '{}');
          const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
          
          console.log(`${index + 1}. ${mail.subject}`);
          console.log(`   👤 ${mail.sender_name}`);
          console.log(`   📅 ${new Date(mail.created_at).toLocaleString()}`);
          console.log(`   📖 Đã đọc: ${mail.is_read ? '✅' : '❌'}`);
          console.log(`   🎁 Có quà: ${hasRewards ? '✅' : '❌'}`);
          console.log(`   💰 Đã nhận: ${mail.is_claimed ? '✅' : '❌'}`);
          if (hasRewards) {
            console.log(`   🎯 Phần thưởng:`, rewards);
          }
          console.log('');
        });
      } catch (parseError) {
        console.error('❌ Lỗi parse response mails:', parseError);
      }
    } else {
      console.error('❌ Lỗi khi lấy danh sách mail:', response.status);
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
  }
}

// Main function
async function main() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🚀 Mail Test System');
  console.log('==================');
  console.log('1. Gửi mail test đến 1 user');
  console.log('2. Gửi mail test đến tất cả user');
  console.log('3. Gửi mail test đến nhiều user');
  console.log('4. Xóa tất cả mail của user');
  console.log('5. Hiển thị mail của user');
  console.log('6. Gửi mail test đến user cụ thể (ID: 1)');
  console.log('7. Gửi mail test đến user cụ thể (ID: 2)');
  console.log('8. Gửi mail test đến user cụ thể (ID: 3)');
  
  rl.question('\nChọn hành động (1-8): ', async (choice) => {
    try {
      switch (choice) {
        case '1': {
          const userId = await new Promise(resolve => {
            rl.question('Nhập User ID: ', resolve);
          });
          await sendTestMailsToUser(parseInt(userId));
          break;
        }
          
        case '2':
          await sendTestMailsToAllUsers();
          break;
          
        case '3': {
          const userIdsInput = await new Promise(resolve => {
            rl.question('Nhập danh sách User ID (phân cách bằng dấu phẩy): ', resolve);
          });
          const userIds = userIdsInput.split(',').map(id => parseInt(id.trim()));
          await sendTestMailsToMultipleUsers(userIds);
          break;
        }
          
        case '4': {
          const deleteUserId = await new Promise(resolve => {
            rl.question('Nhập User ID để xóa mail: ', resolve);
          });
          await deleteAllUserMails(parseInt(deleteUserId));
          break;
        }
          
        case '5': {
          const showUserId = await new Promise(resolve => {
            rl.question('Nhập User ID để xem mail: ', resolve);
          });
          await showUserMails(parseInt(showUserId));
          break;
        }
          
        case '6':
          await sendTestMailsToUser(1);
          break;
          
        case '7':
          await sendTestMailsToUser(2);
          break;
          
        case '8':
          await sendTestMailsToUser(3);
          break;
          
        default:
          console.log('❌ Lựa chọn không hợp lệ');
      }
    } catch (error) {
      console.error('❌ Lỗi:', error.message);
    } finally {
      rl.close();
    }
  });
}

// Chạy script
if (require.main === module) {
  main();
}

module.exports = {
  sendTestMailsToUser,
  sendTestMailsToAllUsers,
  sendTestMailsToMultipleUsers,
  deleteAllUserMails,
  showUserMails,
  systemMails
};

