const ioClient = require('socket.io-client');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = {
    ...options,
    headers
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passedTests = 0;
let failedTests = 0;

function logPass(msg) {
  passedTests++;
  console.log(`  ✅ PASS: ${msg}`);
}

function logFail(msg, err) {
  failedTests++;
  console.error(`  ❌ FAIL: ${msg}`);
  if (err) console.error(`     Error: ${err.message || err}`);
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 TASKFLOW FULL STACK QA & INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let user1Token, user1, user2Token, user2;
  let testProjectId, testTaskId, testCommentId, testNotificationId;

  // 1. Health & MongoDB Check
  console.log('--- 1. Health & Database Connection ---');
  try {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.mongoStatus, 'connected');
    logPass('MongoDB is connected and API health check returns 200 OK');
  } catch (err) {
    logFail('Health check failed', err);
  }

  // 2. Authentication: Registration & Validation
  console.log('\n--- 2. Registration & Validation ---');
  const timestamp = Date.now();
  const testUserEmail = `qa_test_${timestamp}@example.com`;
  const testUsername = `qa_user_${timestamp}`;
  try {
    // Short password check
    const badRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'QA Tester', username: testUsername, email: testUserEmail, password: '123' }
    });
    assert.strictEqual(badRes.status, 400);
    logPass('Registration rejects passwords shorter than 6 characters');

    // Valid registration
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'QA Lead', username: testUsername, email: testUserEmail, password: 'Password123!' }
    });
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.data.success, true);
    assert.ok(regRes.data.data.token);
    assert.strictEqual(regRes.data.data.user.email, testUserEmail);
    logPass('User registration succeeds with valid JWT and sanitized profile');

    // Duplicate email check
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'QA Clone', username: `clone_${timestamp}`, email: testUserEmail, password: 'Password123!' }
    });
    assert.strictEqual(dupRes.status, 400);
    logPass('Registration enforces unique email address constraint');
  } catch (err) {
    logFail('Registration validation failed', err);
  }

  // 3. Authentication: Login & Demo User Login
  console.log('\n--- 3. Login & JWT Authentication ---');
  try {
    // Bad credentials
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: testUserEmail, password: 'WrongPassword' }
    });
    assert.strictEqual(badLogin.status, 401);
    logPass('Login rejects invalid password with 401 Unauthorized');

    // Valid login User 1 (Demo User)
    const login1 = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'demo@taskflow.com', password: 'Demo123' }
    });
    assert.strictEqual(login1.status, 200);
    assert.ok(login1.data.data.token);
    user1Token = login1.data.data.token;
    user1 = login1.data.data.user;
    logPass(`Demo User 1 (Lead) logged in: ${user1.name} (${user1.email})`);

    // Valid login User 2 (Sarah Connor)
    const login2 = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'sarah@taskflow.com', password: 'Demo123' }
    });
    assert.strictEqual(login2.status, 200);
    assert.ok(login2.data.data.token);
    user2Token = login2.data.data.token;
    user2 = login2.data.data.user;
    logPass(`Demo User 2 (Dev) logged in: ${user2.name} (${user2.email})`);
  } catch (err) {
    logFail('Login test failed', err);
  }

  // 4. Authorization & Protected Routes
  console.log('\n--- 4. Authorization & Protected Routes ---');
  try {
    // No token
    const noToken = await request('/api/projects');
    assert.strictEqual(noToken.status, 401);
    logPass('Protected route rejects requests without Authorization header');

    // Invalid token
    const fakeToken = await request('/api/projects', {}, 'bad_token_value');
    assert.strictEqual(fakeToken.status, 401);
    logPass('Protected route rejects requests with invalid JWT');

    // Valid token
    const meRes = await request('/api/auth/me', {}, user1Token);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.data.user._id, user1._id);
    logPass('/api/auth/me returns authenticated user details correctly');
  } catch (err) {
    logFail('Authorization checks failed', err);
  }

  // 5. User Profile Management
  console.log('\n--- 5. User Profiles & Directory ---');
  try {
    // Get directory
    const usersRes = await request('/api/users', {}, user1Token);
    assert.strictEqual(usersRes.status, 200);
    assert.ok(Array.isArray(usersRes.data.data.users));
    assert.ok(usersRes.data.data.users.length >= 2);
    logPass(`User directory returns ${usersRes.data.data.users.length} team members`);

    // Get user stats
    const userDetail = await request(`/api/users/${user1._id}`, {}, user1Token);
    assert.strictEqual(userDetail.status, 200);
    assert.ok(userDetail.data.data.stats);
    logPass('User profile returns activity stats (projects, assigned tasks)');

    // Update profile
    const updateProfile = await request(`/api/users/${user1._id}`, {
      method: 'PUT',
      body: { bio: 'Updated QA Administrator Bio' }
    }, user1Token);
    assert.strictEqual(updateProfile.status, 200);
    assert.strictEqual(updateProfile.data.data.user.bio, 'Updated QA Administrator Bio');
    logPass('User profile bio update succeeds');

    // Forbidden update of another user
    const forbidUpdate = await request(`/api/users/${user2._id}`, {
      method: 'PUT',
      body: { name: 'Hacked Name' }
    }, user1Token);
    assert.strictEqual(forbidUpdate.status, 403);
    logPass('User cannot update another user profile (403 Forbidden)');
  } catch (err) {
    logFail('User profile test failed', err);
  }

  // 6. Project Creation & Progress Calculation
  console.log('\n--- 6. Project Creation & Progress Calculation ---');
  try {
    const projRes = await request('/api/projects', {
      method: 'POST',
      body: {
        name: `Automated QA Project ${timestamp}`,
        description: 'End-to-end verification project for CodeAlpha Task 3',
        color: '#6366f1',
        memberIds: [user2._id]
      }
    }, user1Token);
    assert.strictEqual(projRes.status, 201);
    testProjectId = projRes.data.data.project._id;
    assert.ok(testProjectId);
    assert.strictEqual(projRes.data.data.project.members.length, 2);
    logPass(`Project created with owner and invited member: ID ${testProjectId}`);

    // Verify project listing for user 1 and user 2
    const projList1 = await request(`/api/projects?search=QA Project`, {}, user1Token);
    assert.strictEqual(projList1.status, 200);
    assert.ok(projList1.data.data.projects.some(p => p._id === testProjectId));
    logPass('Project listing with search query matches newly created project');

    const projList2 = await request(`/api/projects`, {}, user2Token);
    assert.strictEqual(projList2.status, 200);
    assert.ok(projList2.data.data.projects.some(p => p._id === testProjectId));
    logPass('Invited member (User 2) has project in their project list');
  } catch (err) {
    logFail('Project creation test failed', err);
  }

  // 7. Project Members Management
  console.log('\n--- 7. Project Members Management ---');
  try {
    // Find third user
    const users = (await request('/api/users', {}, user1Token)).data.data.users;
    const thirdUser = users.find(u => u._id !== user1._id && u._id !== user2._id);
    assert.ok(thirdUser, 'Found third user for member test');

    // Non-owner cannot add members
    const nonOwnerAdd = await request(`/api/projects/${testProjectId}/members`, {
      method: 'POST',
      body: { userId: thirdUser._id }
    }, user2Token);
    assert.strictEqual(nonOwnerAdd.status, 403);
    logPass('Non-owner cannot add members (403 Forbidden)');

    // Owner adds third user
    const addRes = await request(`/api/projects/${testProjectId}/members`, {
      method: 'POST',
      body: { userId: thirdUser._id }
    }, user1Token);
    assert.strictEqual(addRes.status, 200);
    logPass(`Owner successfully added member ${thirdUser.name} to project`);

    // Cannot remove project owner
    const removeOwner = await request(`/api/projects/${testProjectId}/members/${user1._id}`, {
      method: 'DELETE'
    }, user1Token);
    assert.strictEqual(removeOwner.status, 400);
    logPass('Cannot remove project owner from project');

    // Remove third user
    const removeRes = await request(`/api/projects/${testProjectId}/members/${thirdUser._id}`, {
      method: 'DELETE'
    }, user1Token);
    assert.strictEqual(removeRes.status, 200);
    logPass('Owner successfully removed member from project');
  } catch (err) {
    logFail('Project member management test failed', err);
  }

  // 8. Task Creation & Assignment
  console.log('\n--- 8. Task Creation & Assignment ---');
  try {
    // Non-member cannot create task in project
    const randToken = (await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Outsider', username: `outsider_${timestamp}`, email: `out_${timestamp}@test.com`, password: 'Password123!' }
    })).data.data.token;

    const outsiderTask = await request(`/api/projects/${testProjectId}/tasks`, {
      method: 'POST',
      body: { title: 'Unauthorized Task' }
    }, randToken);
    assert.strictEqual(outsiderTask.status, 403);
    logPass('Outsider cannot create task in private project (403 Forbidden)');

    // Cannot assign task to a non-member
    const badAssignTask = await request(`/api/projects/${testProjectId}/tasks`, {
      method: 'POST',
      body: {
        title: 'Bad Assignment Task',
        assignedTo: (await request('/api/users', {}, user1Token)).data.data.users.find(u => u.email === `out_${timestamp}@test.com`)._id
      }
    }, user1Token);
    assert.strictEqual(badAssignTask.status, 400);
    logPass('Task creation rejects assignment to users who are not project members');

    // Create valid Task 1 assigned to User 2
    const task1Res = await request(`/api/projects/${testProjectId}/tasks`, {
      method: 'POST',
      body: {
        title: 'Implement OAuth Login Flow',
        description: 'Set up JWT authentication with refresh token strategy',
        assignedTo: user2._id,
        priority: 'high',
        status: 'todo',
        dueDate: new Date(Date.now() + 86400000).toISOString()
      }
    }, user1Token);
    assert.strictEqual(task1Res.status, 201);
    testTaskId = task1Res.data.data.task._id;
    assert.ok(testTaskId);
    assert.strictEqual(task1Res.data.data.task.assignedTo._id, user2._id);
    logPass(`Task created and assigned to ${user2.name}: ID ${testTaskId}`);

    // Create Task 2
    const task2Res = await request(`/api/projects/${testProjectId}/tasks`, {
      method: 'POST',
      body: {
        title: 'Design Kanban UI Wireframes',
        description: 'Create responsive drag-and-drop column layouts',
        assignedTo: user1._id,
        priority: 'medium',
        status: 'completed'
      }
    }, user1Token);
    assert.strictEqual(task2Res.status, 201);
    logPass('Task 2 created in completed status');

    // Check project progress calculation: 1 out of 2 completed = 50%
    const projCheck = await request(`/api/projects/${testProjectId}`, {}, user1Token);
    assert.strictEqual(projCheck.status, 200);
    assert.strictEqual(projCheck.data.data.project.totalTasks, 2);
    assert.strictEqual(projCheck.data.data.project.completedTasks, 1);
    assert.strictEqual(projCheck.data.data.project.progress, 50);
    logPass('Project progress calculation verified: 1/2 tasks completed = 50%');
  } catch (err) {
    logFail('Task creation and assignment test failed', err);
  }

  // 9. Drag-and-Drop Task Status Movement
  console.log('\n--- 9. Drag-and-Drop Task Status Movement ---');
  try {
    const moveRes = await request(`/api/tasks/${testTaskId}/status`, {
      method: 'PUT',
      body: { status: 'in-progress', position: 1 }
    }, user2Token);
    assert.strictEqual(moveRes.status, 200);
    assert.strictEqual(moveRes.data.data.task.status, 'in-progress');
    logPass('Drag-and-drop status update (todo -> in-progress) succeeded');

    // Invalid status validation
    const badMove = await request(`/api/tasks/${testTaskId}/status`, {
      method: 'PUT',
      body: { status: 'invalid-status' }
    }, user2Token);
    assert.strictEqual(badMove.status, 400);
    logPass('Invalid status update rejected with 400 Bad Request');
  } catch (err) {
    logFail('Task status movement failed', err);
  }

  // 10. Task Editing
  console.log('\n--- 10. Task Editing ---');
  try {
    const editRes = await request(`/api/tasks/${testTaskId}`, {
      method: 'PUT',
      body: {
        title: 'Implement OAuth & Biometric Auth Flow (Updated)',
        priority: 'urgent',
        description: 'Comprehensive OAuth 2.0 and WebAuthn support'
      }
    }, user1Token);
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.data.data.task.title, 'Implement OAuth & Biometric Auth Flow (Updated)');
    assert.strictEqual(editRes.data.data.task.priority, 'urgent');
    logPass('Task details updated (title, priority, description)');
  } catch (err) {
    logFail('Task editing test failed', err);
  }

  // 11. Comments Discussion & Deletion
  console.log('\n--- 11. Task Comments Discussion ---');
  try {
    // User 2 adds a comment
    const commentRes = await request(`/api/tasks/${testTaskId}/comments`, {
      method: 'POST',
      body: { text: 'Started implementing this feature. Mockups look great!' }
    }, user2Token);
    assert.strictEqual(commentRes.status, 201);
    testCommentId = commentRes.data.data.comment._id;
    assert.ok(testCommentId);
    assert.strictEqual(commentRes.data.data.comment.text, 'Started implementing this feature. Mockups look great!');
    logPass(`User 2 posted comment: "${commentRes.data.data.comment.text}"`);

    // Get comments list
    const commentsList = await request(`/api/tasks/${testTaskId}/comments`, {}, user1Token);
    assert.strictEqual(commentsList.status, 200);
    assert.ok(commentsList.data.data.comments.some(c => c._id === testCommentId));
    logPass('Task comments list retrieved and contains newly posted comment');

    // Non-owner, non-author cannot delete
    const randomUserToken = (await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Third Party', username: `party_${timestamp}`, email: `party_${timestamp}@test.com`, password: 'Password123!' }
    })).data.data.token;
    const forbidDelete = await request(`/api/comments/${testCommentId}`, {
      method: 'DELETE'
    }, randomUserToken);
    assert.strictEqual(forbidDelete.status, 403);
    logPass('Unauthorized user cannot delete someone else\'s comment (403)');
  } catch (err) {
    logFail('Comment test failed', err);
  }

  // 12. Notifications Management
  console.log('\n--- 12. Notifications API ---');
  try {
    const notifRes = await request('/api/notifications', {}, user2Token);
    assert.strictEqual(notifRes.status, 200);
    assert.ok(Array.isArray(notifRes.data.data.notifications));
    const notifs = notifRes.data.data.notifications;
    assert.ok(notifs.length > 0, 'User 2 received notifications for task assignment / project');
    testNotificationId = notifs[0]._id;
    logPass(`User 2 notifications retrieved (${notifs.length} total, unread: ${notifRes.data.data.unreadCount})`);

    // Mark single as read
    const markOne = await request(`/api/notifications/${testNotificationId}/read`, {
      method: 'PUT'
    }, user2Token);
    assert.strictEqual(markOne.status, 200);
    assert.strictEqual(markOne.data.data.notification.isRead, true);
    logPass('Single notification marked as read');

    // Mark all as read
    const markAll = await request('/api/notifications/read-all', {
      method: 'PUT'
    }, user2Token);
    assert.strictEqual(markAll.status, 200);
    logPass('Mark all notifications as read succeeded');
  } catch (err) {
    logFail('Notification test failed', err);
  }

  // 13. Real-Time Multi-User WebSockets
  console.log('\n--- 13. Real-Time Multi-User WebSockets Collaboration ---');
  try {
    let client1 = ioClient(BASE_URL, { auth: { token: user1Token }, reconnection: false });
    let client2 = ioClient(BASE_URL, { auth: { token: user2Token }, reconnection: false });

    await new Promise((resolve, reject) => {
      let c1Connected = false, c2Connected = false;
      const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 4000);
      client1.on('connect', () => {
        c1Connected = true;
        if (c1Connected && c2Connected) { clearTimeout(timeout); resolve(); }
      });
      client2.on('connect', () => {
        c2Connected = true;
        if (c1Connected && c2Connected) { clearTimeout(timeout); resolve(); }
      });
    });
    logPass('Both clients (User 1 & User 2) connected via WebSockets');

    // Both join project room
    client1.emit('joinProject', testProjectId);
    client2.emit('joinProject', testProjectId);
    client2.emit('joinUser', user2._id);

    // Wait 200ms for room join
    await new Promise(r => setTimeout(r, 200));

    // Test: User 1 creates task -> User 2 receives 'taskCreated'
    const taskCreatedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for taskCreated socket event')), 5000);
      client2.on('taskCreated', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    const newTaskRes = await request(`/api/projects/${testProjectId}/tasks`, {
      method: 'POST',
      body: {
        title: 'Real-Time WebSocket Sync Verification',
        description: 'Verify instant broadcast across open client windows',
        priority: 'urgent',
        status: 'todo'
      }
    }, user1Token);
    const createdTask = newTaskRes.data.data.task;

    const taskCreatedPayload = await taskCreatedPromise;
    assert.strictEqual(taskCreatedPayload.task._id, createdTask._id);
    logPass(`User 2 received real-time 'taskCreated' WebSocket event for "${taskCreatedPayload.task.title}"`);

    // Test: User 1 moves task -> User 2 receives 'taskMoved'
    const taskMovedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for taskMoved socket event')), 5000);
      client2.on('taskMoved', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    await request(`/api/tasks/${createdTask._id}/status`, {
      method: 'PUT',
      body: { status: 'in-review', position: 0 }
    }, user1Token);

    const taskMovedPayload = await taskMovedPromise;
    assert.strictEqual(taskMovedPayload.task._id, createdTask._id);
    assert.strictEqual(taskMovedPayload.task.status, 'in-review');
    assert.strictEqual(taskMovedPayload.previousStatus, 'todo');
    logPass(`User 2 received real-time 'taskMoved' event (todo -> in-review)`);

    // Test: User 1 posts comment -> User 2 receives 'commentAdded'
    const commentAddedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for commentAdded socket event')), 5000);
      client2.on('commentAdded', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    const addedComment = await request(`/api/tasks/${createdTask._id}/comments`, {
      method: 'POST',
      body: { text: 'Real-time WebSocket comment test message' }
    }, user1Token);

    const commentAddedPayload = await commentAddedPromise;
    assert.strictEqual(commentAddedPayload.taskId, createdTask._id);
    assert.strictEqual(commentAddedPayload.comment.text, 'Real-time WebSocket comment test message');
    logPass(`User 2 received real-time 'commentAdded' event with instant comment text`);

    // Test: User 1 deletes task -> User 2 receives 'taskDeleted'
    const taskDeletedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for taskDeleted socket event')), 5000);
      client2.on('taskDeleted', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    await request(`/api/tasks/${createdTask._id}`, {
      method: 'DELETE'
    }, user1Token);

    const taskDeletedPayload = await taskDeletedPromise;
    assert.strictEqual(taskDeletedPayload.taskId, createdTask._id);
    logPass(`User 2 received real-time 'taskDeleted' event for deleted task`);

    client1.disconnect();
    client2.disconnect();
    logPass('WebSockets disconnected cleanly');
  } catch (err) {
    logFail('Real-Time WebSockets test failed', err);
  }

  // 14. Clean up test artifacts
  console.log('\n--- 14. Project Deletion (Cascading Tasks & Comments) ---');
  try {
    const delRes = await request(`/api/projects/${testProjectId}`, {
      method: 'DELETE'
    }, user1Token);
    assert.strictEqual(delRes.status, 200);
    logPass('Owner successfully deleted test project and all associated tasks/comments');

    // Confirm tasks were cascaded
    const taskCheck = await request(`/api/tasks/${testTaskId}`, {}, user1Token);
    assert.strictEqual(taskCheck.status, 404);
    logPass('Cascaded tasks were verified deleted (404 Not Found)');
  } catch (err) {
    logFail('Project cleanup failed', err);
  }

  console.log('\n====================================================');
  console.log(`QA TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled QA test error:', err);
  process.exit(1);
});
