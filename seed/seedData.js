const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskflow';

const seedDatabase = async () => {
  try {
    console.log(`[Seed] Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] Connected successfully.');

    // Clear existing data
    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      Comment.deleteMany({}),
      Notification.deleteMany({})
    ]);

    // 1. Create 5 Demo Users with hashed passwords
    console.log('[Seed] Creating demo users...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Demo123', salt);

    const usersData = [
      {
        name: 'Demo User',
        username: 'demouser',
        email: 'demo@taskflow.com',
        password: hashedPassword,
        bio: 'Lead Full-Stack Engineer and Project Administrator.',
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      },
      {
        name: 'Sarah Connor',
        username: 'sarah_dev',
        email: 'sarah@taskflow.com',
        password: hashedPassword,
        bio: 'Senior Frontend Developer specializing in responsive design and modern UX.',
        profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
      },
      {
        name: 'Alex Morgan',
        username: 'alex_backend',
        email: 'alex@taskflow.com',
        password: hashedPassword,
        bio: 'Backend Architect, Node.js enthusiast, and database optimization specialist.',
        profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
      },
      {
        name: 'Elena Rostova',
        username: 'elena_ui',
        email: 'elena@taskflow.com',
        password: hashedPassword,
        bio: 'UI/UX Product Designer obsessed with typography, micro-interactions, and design systems.',
        profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
      },
      {
        name: 'David Kim',
        username: 'david_qa',
        email: 'david@taskflow.com',
        password: hashedPassword,
        bio: 'QA Engineer and Automation Specialist ensuring zero regressions.',
        profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
      }
    ];

    const users = await User.create(usersData);
    const [demoUser, sarah, alex, elena, david] = users;
    console.log(`[Seed] Created ${users.length} demo users.`);

    // 2. Create 3 Sample Projects
    console.log('[Seed] Creating sample projects...');
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const project1 = await Project.create({
      name: 'Website Development',
      description: 'Build and deploy a modern company website with responsive UI and real-time collaboration.',
      owner: demoUser._id,
      color: '#6366f1',
      startDate: now,
      dueDate: thirtyDaysFromNow,
      status: 'active',
      members: [
        { user: demoUser._id, role: 'owner' },
        { user: sarah._id, role: 'member' },
        { user: alex._id, role: 'member' },
        { user: elena._id, role: 'member' },
        { user: david._id, role: 'member' }
      ]
    });

    const project2 = await Project.create({
      name: 'Mobile App v2.0',
      description: 'Redesign and build iOS and Android apps with offline caching, push notifications, and biometric login.',
      owner: demoUser._id,
      color: '#06b6d4',
      startDate: now,
      dueDate: sixtyDaysFromNow,
      status: 'active',
      members: [
        { user: demoUser._id, role: 'owner' },
        { user: sarah._id, role: 'member' },
        { user: elena._id, role: 'member' },
        { user: david._id, role: 'member' }
      ]
    });

    const project3 = await Project.create({
      name: 'Cloud Infrastructure Migration',
      description: 'Migrate legacy on-premise servers to AWS ECS, automate CI/CD with GitHub Actions, and set up Redis cluster.',
      owner: alex._id,
      color: '#10b981',
      startDate: now,
      dueDate: fortyDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
      status: 'active',
      members: [
        { user: alex._id, role: 'owner' },
        { user: demoUser._id, role: 'member' },
        { user: david._id, role: 'member' }
      ]
    });

    console.log('[Seed] Created 3 projects.');

    // 3. Create Tasks (at least 18 tasks across all projects and statuses)
    console.log('[Seed] Creating tasks...');
    const tasksData = [
      // Project 1 Tasks
      {
        project: project1._id,
        title: 'Create wireframes',
        description: 'Design comprehensive low and high fidelity wireframes in Figma covering desktop and mobile views.',
        assignedTo: elena._id,
        createdBy: demoUser._id,
        priority: 'high',
        status: 'todo',
        position: 0,
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        tags: ['design', 'ui/ux', 'figma']
      },
      {
        project: project1._id,
        title: 'Setup database',
        description: 'Provision MongoDB cluster, create initial database schema, indexes, and connection pooling.',
        assignedTo: alex._id,
        createdBy: demoUser._id,
        priority: 'high',
        status: 'todo',
        position: 1,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        tags: ['backend', 'database', 'mongodb']
      },
      {
        project: project1._id,
        title: 'Develop homepage',
        description: 'Implement responsive hero banner, product highlights section, customer testimonials, and footer.',
        assignedTo: sarah._id,
        createdBy: demoUser._id,
        priority: 'medium',
        status: 'in-progress',
        position: 0,
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        tags: ['frontend', 'html5', 'css3']
      },
      {
        project: project1._id,
        title: 'Build authentication',
        description: 'Implement JWT authentication with secure password hashing via bcrypt, user login, and token verification middleware.',
        assignedTo: demoUser._id,
        createdBy: demoUser._id,
        priority: 'urgent',
        status: 'in-progress',
        position: 1,
        dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        tags: ['backend', 'security', 'auth']
      },
      {
        project: project1._id,
        title: 'Test login system',
        description: 'Perform end-to-end regression tests on authentication flows, boundary test inputs, and verify rate limits.',
        assignedTo: david._id,
        createdBy: demoUser._id,
        priority: 'high',
        status: 'in-review',
        position: 0,
        dueDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        tags: ['qa', 'testing', 'security']
      },
      {
        project: project1._id,
        title: 'Setup project repository',
        description: 'Initialize Git repository, configure .gitignore, setup branch protection rules, and add CodeAlpha guidelines.',
        assignedTo: demoUser._id,
        createdBy: demoUser._id,
        priority: 'low',
        status: 'completed',
        position: 0,
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        tags: ['devops', 'git']
      },
      {
        project: project1._id,
        title: 'Implement Dark Mode Theme',
        description: 'Add CSS custom properties variables for modern dark/light mode toggle with smooth color transitions.',
        assignedTo: elena._id,
        createdBy: sarah._id,
        priority: 'low',
        status: 'todo',
        position: 2,
        dueDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
        tags: ['ui', 'theme']
      },
      {
        project: project1._id,
        title: 'WebSocket Live Sync Module',
        description: 'Integrate Socket.IO client and server listeners for instant task updates across active browser tabs.',
        assignedTo: alex._id,
        createdBy: demoUser._id,
        priority: 'urgent',
        status: 'in-progress',
        position: 2,
        dueDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        tags: ['real-time', 'websockets']
      },

      // Project 2 Tasks (Mobile App)
      {
        project: project2._id,
        title: 'Design Mobile Navigation System',
        description: 'Create bottom navigation bar and gesture-based drawer navigation for mobile screen layouts.',
        assignedTo: elena._id,
        createdBy: demoUser._id,
        priority: 'medium',
        status: 'in-progress',
        position: 0,
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        tags: ['mobile', 'design']
      },
      {
        project: project2._id,
        title: 'Biometric Authentication Flow',
        description: 'Implement FaceID and Fingerprint authentication with keychain token storage.',
        assignedTo: sarah._id,
        createdBy: demoUser._id,
        priority: 'high',
        status: 'todo',
        position: 0,
        dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        tags: ['mobile', 'security']
      },
      {
        project: project2._id,
        title: 'Offline Data Synchronization',
        description: 'Set up SQLite local storage to queue offline operations and synchronize when internet returns.',
        assignedTo: demoUser._id,
        createdBy: demoUser._id,
        priority: 'urgent',
        status: 'todo',
        position: 1,
        dueDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
        tags: ['offline', 'sync']
      },
      {
        project: project2._id,
        title: 'Push Notification Integration',
        description: 'Integrate Firebase Cloud Messaging for instant task assignment notifications.',
        assignedTo: david._id,
        createdBy: demoUser._id,
        priority: 'medium',
        status: 'completed',
        position: 0,
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        tags: ['notifications', 'fcm']
      },

      // Project 3 Tasks (Cloud Infrastructure)
      {
        project: project3._id,
        title: 'Set up Docker Containers',
        description: 'Write multi-stage Dockerfiles for Node backend and Nginx reverse proxy.',
        assignedTo: alex._id,
        createdBy: alex._id,
        priority: 'high',
        status: 'completed',
        position: 0,
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        tags: ['docker', 'containers']
      },
      {
        project: project3._id,
        title: 'AWS VPC and Security Groups',
        description: 'Configure private subnets, NAT Gateways, and strict inbound/outbound firewall rules.',
        assignedTo: alex._id,
        createdBy: alex._id,
        priority: 'urgent',
        status: 'completed',
        position: 1,
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        tags: ['aws', 'security']
      },
      {
        project: project3._id,
        title: 'Setup GitHub Actions CI/CD',
        description: 'Automate build testing, lint checks, and zero-downtime deployment pipeline.',
        assignedTo: demoUser._id,
        createdBy: alex._id,
        priority: 'high',
        status: 'in-progress',
        position: 0,
        dueDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
        tags: ['ci/cd', 'devops']
      },
      {
        project: project3._id,
        title: 'Load Testing and Benchmark Analysis',
        description: 'Execute ApacheBench and k6 stress tests to evaluate API latency under 5,000 req/sec.',
        assignedTo: david._id,
        createdBy: alex._id,
        priority: 'medium',
        status: 'todo',
        position: 0,
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        tags: ['qa', 'benchmark']
      }
    ];

    const tasks = await Task.create(tasksData);
    console.log(`[Seed] Created ${tasks.length} tasks.`);

    // 4. Create Task Comments
    console.log('[Seed] Creating task comments...');
    const authTask = tasks.find(t => t.title === 'Build authentication');
    const testTask = tasks.find(t => t.title === 'Test login system');
    const homeTask = tasks.find(t => t.title === 'Develop homepage');

    const commentsData = [
      {
        task: authTask._id,
        user: alex._id,
        text: 'I recommend using bcryptjs with at least 12 salt rounds for password security.'
      },
      {
        task: authTask._id,
        user: demoUser._id,
        text: 'Agreed! 12 rounds implemented. JWT token expiration is set to 30 days.'
      },
      {
        task: testTask._id,
        user: david._id,
        text: 'Initial smoke tests pass! Checking edge cases with malformed tokens and expired sessions now.'
      },
      {
        task: testTask._id,
        user: demoUser._id,
        text: 'Awesome work David, let me know if any route fails authorization.'
      },
      {
        task: homeTask._id,
        user: elena._id,
        text: 'I updated the color palette in Figma to use indigo and cyan for better contrast ratio.'
      },
      {
        task: homeTask._id,
        user: sarah._id,
        text: 'Got it! Integrating the new design tokens and glassmorphic card styles now.'
      }
    ];

    await Comment.create(commentsData);
    console.log(`[Seed] Created ${commentsData.length} comments.`);

    // 5. Create Sample Notifications
    console.log('[Seed] Creating sample notifications...');
    const notificationsData = [
      {
        recipient: demoUser._id,
        sender: sarah._id,
        type: 'comment_added',
        message: 'Sarah Connor commented on "Develop homepage"',
        project: project1._id,
        task: homeTask._id,
        isRead: false
      },
      {
        recipient: demoUser._id,
        sender: david._id,
        type: 'task_status_changed',
        message: 'Task "Test login system" moved to in-review',
        project: project1._id,
        task: testTask._id,
        isRead: false
      },
      {
        recipient: demoUser._id,
        sender: alex._id,
        type: 'member_added',
        message: 'Alex Morgan added you to project "Cloud Infrastructure Migration"',
        project: project3._id,
        isRead: true
      },
      {
        recipient: sarah._id,
        sender: demoUser._id,
        type: 'task_assigned',
        message: 'Demo User assigned you a new task: "Develop homepage"',
        project: project1._id,
        task: homeTask._id,
        isRead: true
      }
    ];

    await Notification.create(notificationsData);
    console.log(`[Seed] Created ${notificationsData.length} notifications.`);

    console.log('===============================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('Demo Credentials:');
    console.log('Email:    demo@taskflow.com');
    console.log('Password: Demo123');
    console.log('===============================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
