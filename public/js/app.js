/**
 * TaskFlow Main Application Controller
 * Manages Views, Kanban Drag-and-Drop, Modals, Tasks, Projects, Comments, and Real-Time Sync
 */

const App = {
  currentUser: null,
  currentView: 'dashboard',
  currentProject: null,
  activeTaskId: null,
  allProjects: [],
  allTasks: [],
  notifications: [],
  unreadNotificationsCount: 0,
  draggedTaskId: null,

  init() {
    this.bindDOMEvents();
    this.bindSocketEvents();
  },

  onUserLoggedIn(user) {
    this.currentUser = user;
    this.updateUserUI(user);
    this.loadInitialData();
  },

  onUserLoggedOut() {
    this.currentUser = null;
    this.currentProject = null;
    this.allProjects = [];
    this.allTasks = [];
    this.switchView('dashboard');
  },

  updateUserUI(user) {
    if (!user) return;
    const nameEls = document.querySelectorAll('.user-display-name');
    nameEls.forEach(el => el.textContent = user.name);

    const emailEls = document.querySelectorAll('.user-display-email');
    emailEls.forEach(el => el.textContent = user.email);

    const avatarEls = document.querySelectorAll('.user-avatar-img');
    avatarEls.forEach(el => {
      if (user.profileImage) {
        el.src = user.profileImage;
        el.classList.remove('hidden');
        if (el.nextElementSibling?.classList.contains('user-avatar-initials')) {
          el.nextElementSibling.classList.add('hidden');
        }
      } else {
        el.classList.add('hidden');
        if (el.nextElementSibling?.classList.contains('user-avatar-initials')) {
          el.nextElementSibling.textContent = this.getInitials(user.name);
          el.nextElementSibling.classList.remove('hidden');
        }
      }
    });
  },

  getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  },

  async loadInitialData() {
    await Promise.all([
      this.loadProjects(),
      this.loadNotifications()
    ]);
    this.renderDashboard();
  },

  bindDOMEvents() {
    // Navigation items
    document.querySelectorAll('[data-view-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = el.dataset.viewTarget;
        this.switchView(targetView);
      });
    });

    // Mobile Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Close sidebar on navigation in mobile
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768 && sidebar) {
          sidebar.classList.remove('open');
        }
      });
    });

    // Notification Dropdown Toggle
    const notifBtn = document.getElementById('notification-bell-btn');
    const notifDropdown = document.getElementById('notification-dropdown');
    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('hidden');
      });
    }

    // Mark all read button
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => this.markAllNotificationsRead());
    }

    // User Menu Dropdown Toggle
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-menu-dropdown');
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
      });
    }

    // Global click listener to close popups
    document.addEventListener('click', (e) => {
      if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.classList.add('hidden');
      }
      if (userDropdown && !userDropdown.contains(e.target) && e.target !== userMenuBtn) {
        userDropdown.classList.add('hidden');
      }
    });

    // Global Search
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.handleGlobalSearch(e.target.value.trim());
        }, 300);
      });
    }

    // Modals Close Buttons
    document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal-container');
        if (modal) modal.classList.add('hidden');
      });
    });

    // New Project Modal Openers
    document.querySelectorAll('.btn-open-create-project').forEach(btn => {
      btn.addEventListener('click', () => this.openCreateProjectModal());
    });

    // New Project Form Submit
    const createProjectForm = document.getElementById('create-project-form');
    if (createProjectForm) {
      createProjectForm.addEventListener('submit', (e) => this.handleCreateProject(e));
    }

    // New Task Modal Openers
    document.querySelectorAll('.btn-open-create-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const defaultStatus = btn.dataset.status || 'todo';
        this.openCreateTaskModal(defaultStatus);
      });
    });

    // New Task Form Submit
    const createTaskForm = document.getElementById('create-task-form');
    if (createTaskForm) {
      createTaskForm.addEventListener('submit', (e) => this.handleCreateTask(e));
    }

    // Edit Task Form Submit
    const editTaskForm = document.getElementById('edit-task-form');
    if (editTaskForm) {
      editTaskForm.addEventListener('submit', (e) => this.handleUpdateTask(e));
    }

    // Delete Task Button
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    if (deleteTaskBtn) {
      deleteTaskBtn.addEventListener('click', () => this.handleDeleteTask());
    }

    // Add Comment Form Submit
    const commentForm = document.getElementById('add-comment-form');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => this.handleAddComment(e));
    }

    // Profile Modal Opener
    const profileBtn = document.getElementById('profile-menu-item');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.openProfileModal());
    }

    // Profile Form Submit
    const profileForm = document.getElementById('edit-profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleUpdateProfile(e));
    }

    // Add Member to Project Form
    const addMemberForm = document.getElementById('add-member-form');
    if (addMemberForm) {
      addMemberForm.addEventListener('submit', (e) => this.handleAddMember(e));
    }

    // Manage Members Modal Opener
    const manageMembersBtn = document.getElementById('btn-manage-members');
    if (manageMembersBtn) {
      manageMembersBtn.addEventListener('click', () => this.openMembersModal());
    }

    // Kanban Drag and Drop setup
    this.setupKanbanDragAndDrop();
  },

  bindSocketEvents() {
    window.addEventListener('socket:taskCreated', (e) => {
      const { task } = e.detail;
      if (this.currentProject && task.project === this.currentProject._id) {
        this.renderTaskCard(task);
        this.updateProjectStatsDOM();
      }
      this.showToast(`New task added: "${task.title}"`, 'info');
    });

    window.addEventListener('socket:taskUpdated', (e) => {
      const { task } = e.detail;
      if (this.currentProject && (task.project === this.currentProject._id || task.project._id === this.currentProject._id)) {
        this.updateTaskCardDOM(task);
        this.updateProjectStatsDOM();
      }
      if (this.activeTaskId === task._id) {
        this.fillTaskDetailModal(task);
      }
    });

    window.addEventListener('socket:taskMoved', (e) => {
      const { task } = e.detail;
      if (this.currentProject && (task.project === this.currentProject._id || task.project._id === this.currentProject._id)) {
        this.moveTaskCardDOM(task);
        this.updateProjectStatsDOM();
      }
    });

    window.addEventListener('socket:taskDeleted', (e) => {
      const { taskId } = e.detail;
      const el = document.getElementById(`task-card-${taskId}`);
      if (el) el.remove();
      if (this.activeTaskId === taskId) {
        document.getElementById('task-detail-modal')?.classList.add('hidden');
      }
      this.updateProjectStatsDOM();
    });

    window.addEventListener('socket:commentAdded', (e) => {
      const { taskId, comment } = e.detail;
      if (this.activeTaskId === taskId) {
        this.appendCommentDOM(comment);
      }
      // Update badge on card
      const card = document.getElementById(`task-card-${taskId}`);
      if (card) {
        const commentCountEl = card.querySelector('.task-comment-count');
        if (commentCountEl) {
          const current = parseInt(commentCountEl.textContent || '0', 10);
          commentCountEl.textContent = current + 1;
        }
      }
    });

    window.addEventListener('socket:commentDeleted', (e) => {
      const { taskId, commentId } = e.detail;
      const commentEl = document.getElementById(`comment-${commentId}`);
      if (commentEl) commentEl.remove();
      const card = document.getElementById(`task-card-${taskId}`);
      if (card) {
        const commentCountEl = card.querySelector('.task-comment-count');
        if (commentCountEl) {
          const current = Math.max(0, parseInt(commentCountEl.textContent || '1', 10) - 1);
          commentCountEl.textContent = current;
        }
      }
    });

    window.addEventListener('socket:notificationCreated', (e) => {
      const notification = e.detail;
      this.notifications.unshift(notification);
      this.unreadNotificationsCount += 1;
      this.renderNotificationBadge();
      this.renderNotificationsList();
      this.showToast(notification.message, 'info');
    });

    window.addEventListener('socket:memberAdded', (e) => {
      const { project } = e.detail;
      if (this.currentProject && this.currentProject._id === project._id) {
        this.currentProject = project;
        this.renderBoardHeader(project);
      }
    });

    window.addEventListener('socket:memberRemoved', (e) => {
      const { projectId, userId } = e.detail;
      if (this.currentProject && this.currentProject._id === projectId) {
        if (this.currentUser && this.currentUser._id === userId) {
          this.showToast('You have been removed from this project.', 'warning');
          this.switchView('projects');
        } else {
          this.loadProjectBoard(projectId);
        }
      }
    });
  },

  switchView(viewName, param = null) {
    this.currentView = viewName;

    // Update active state in sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
      if (el.dataset.viewTarget === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    // Show target view panel
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    // Leave previous project socket room if navigating away from board
    if (viewName !== 'board' && this.currentProject) {
      SocketManager.leaveProject(this.currentProject._id);
      this.currentProject = null;
    }

    // View specific data loading
    if (viewName === 'dashboard') {
      this.renderDashboard();
    } else if (viewName === 'projects') {
      this.loadProjects();
    } else if (viewName === 'board' && param) {
      this.loadProjectBoard(param);
    } else if (viewName === 'tasks') {
      this.loadAllTasksView();
    } else if (viewName === 'members') {
      this.loadMembersView();
    }
  },

  // ----------------------------------------------------
  // DASHBOARD VIEW
  // ----------------------------------------------------
  async renderDashboard() {
    try {
      const [projRes, tasksRes] = await Promise.all([
        API.getProjects(),
        API.getAllTasks()
      ]);

      const projects = projRes.data?.projects || [];
      const tasks = tasksRes.data?.tasks || [];
      this.allProjects = projects;
      this.allTasks = tasks;

      // Stats Counters
      const totalProjects = projects.length;
      const assignedToMe = tasks.filter(t => t.assignedTo?._id === this.currentUser?._id);
      const activeTasks = tasks.filter(t => t.status !== 'completed').length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;

      document.getElementById('stat-total-projects').textContent = totalProjects;
      document.getElementById('stat-my-tasks').textContent = assignedToMe.length;
      document.getElementById('stat-active-tasks').textContent = activeTasks;
      document.getElementById('stat-completed-tasks').textContent = completedTasks;

      // Render Dashboard Projects Summary
      const projContainer = document.getElementById('dashboard-projects-container');
      if (projContainer) {
        if (projects.length === 0) {
          projContainer.innerHTML = `
            <div class="empty-state">
              <p>No projects yet. Create your first project to start collaborating!</p>
              <button class="btn btn-primary btn-sm btn-open-create-project">Create Project</button>
            </div>
          `;
        } else {
          projContainer.innerHTML = projects.slice(0, 4).map(p => this.createProjectCardHTML(p)).join('');
        }
      }

      // Render Recent Tasks Summary
      const taskContainer = document.getElementById('dashboard-tasks-container');
      if (taskContainer) {
        if (tasks.length === 0) {
          taskContainer.innerHTML = '<div class="empty-state"><p>No tasks assigned yet.</p></div>';
        } else {
          taskContainer.innerHTML = tasks.slice(0, 5).map(t => this.createTaskRowHTML(t)).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  },

  createProjectCardHTML(p) {
    const total = p.totalTasks || 0;
    const completed = p.completedTasks || 0;
    const progress = p.progress || 0;
    const members = p.members || [];
    const isOwner = p.owner?._id === this.currentUser?._id;

    return `
      <div class="project-card" style="border-top-color: ${p.color || '#6366f1'}" onclick="App.switchView('board', '${p._id}')">
        <div class="project-card-header">
          <div class="project-title-wrap">
            <h3 class="project-card-title">${this.escapeHTML(p.name)}</h3>
            ${isOwner ? '<span class="badge badge-owner">Owner</span>' : ''}
          </div>
          <span class="project-status-dot status-${p.status || 'active'}"></span>
        </div>
        <p class="project-card-desc">${this.escapeHTML(p.description || 'No description provided.')}</p>
        
        <div class="project-progress-wrap">
          <div class="progress-bar-labels">
            <span>Progress (${completed}/${total} tasks)</span>
            <span class="progress-percent">${progress}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${progress}%; background-color: ${p.color || '#6366f1'};"></div>
          </div>
        </div>

        <div class="project-card-footer">
          <div class="avatar-stack">
            ${members.slice(0, 4).map(m => {
              const u = m.user;
              if (!u) return '';
              return u.profileImage
                ? `<img src="${u.profileImage}" alt="${u.name}" class="avatar avatar-sm" title="${u.name}">`
                : `<span class="avatar avatar-sm avatar-fallback" title="${u.name}">${this.getInitials(u.name)}</span>`;
            }).join('')}
            ${members.length > 4 ? `<span class="avatar avatar-sm avatar-more">+${members.length - 4}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); App.switchView('board', '${p._id}')">
            Open Board &rarr;
          </button>
        </div>
      </div>
    `;
  },

  createTaskRowHTML(t) {
    const priorityClass = `priority-${t.priority}`;
    const statusClass = `status-${t.status}`;
    const projectName = t.project?.name || 'Project';

    return `
      <div class="task-table-row" onclick="App.openTaskDetailModal('${t._id}')">
        <div class="task-row-main">
          <span class="priority-indicator ${priorityClass}"></span>
          <span class="task-row-title">${this.escapeHTML(t.title)}</span>
          <span class="badge badge-project">${this.escapeHTML(projectName)}</span>
        </div>
        <div class="task-row-meta">
          <span class="badge ${statusClass}">${this.formatStatus(t.status)}</span>
          <span class="badge ${priorityClass}">${t.priority}</span>
          ${t.assignedTo ? `<span class="assignee-tag">${t.assignedTo.name}</span>` : '<span class="text-muted">Unassigned</span>'}
        </div>
      </div>
    `;
  },

  // ----------------------------------------------------
  // PROJECTS VIEW
  // ----------------------------------------------------
  async loadProjects() {
    try {
      const res = await API.getProjects();
      this.allProjects = res.data?.projects || [];
      this.renderProjectsGrid(this.allProjects);
    } catch (err) {
      this.showToast('Failed to load projects: ' + err.message, 'error');
    }
  },

  renderProjectsGrid(projects) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-large">
          <div class="empty-icon">📁</div>
          <h3>No Projects Found</h3>
          <p>Create your first collaborative project board to organize tasks with your team.</p>
          <button class="btn btn-primary btn-open-create-project">+ Create Project</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = projects.map(p => this.createProjectCardHTML(p)).join('');
  },

  openCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('proj-name').focus();
    }
  },

  async handleCreateProject(e) {
    e.preventDefault();
    const name = document.getElementById('proj-name').value.trim();
    const description = document.getElementById('proj-desc').value.trim();
    const color = document.getElementById('proj-color').value || '#6366f1';
    const dueDate = document.getElementById('proj-due-date').value || null;
    const submitBtn = document.getElementById('create-project-submit-btn');

    if (!name) {
      this.showToast('Please enter a project name', 'warning');
      return;
    }

    Auth.setLoading(submitBtn, true, 'Creating...');

    try {
      const response = await API.createProject({ name, description, color, dueDate });
      if (response.success && response.data) {
        this.showToast('Project created successfully!', 'success');
        document.getElementById('create-project-modal').classList.add('hidden');
        document.getElementById('create-project-form').reset();
        await this.loadProjects();
        this.switchView('board', response.data.project._id);
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      Auth.setLoading(submitBtn, false, 'Create Project');
    }
  },

  // ----------------------------------------------------
  // KANBAN PROJECT BOARD VIEW
  // ----------------------------------------------------
  async loadProjectBoard(projectId) {
    try {
      const [projRes, tasksRes] = await Promise.all([
        API.getProject(projectId),
        API.getProjectTasks(projectId)
      ]);

      const project = projRes.data?.project;
      const tasks = tasksRes.data?.tasks || [];

      if (!project) {
        this.showToast('Project not found', 'error');
        this.switchView('projects');
        return;
      }

      this.currentProject = project;
      SocketManager.joinProject(projectId);

      this.renderBoardHeader(project);
      this.renderBoardColumns(tasks);
    } catch (err) {
      this.showToast('Failed to load board: ' + err.message, 'error');
      this.switchView('projects');
    }
  },

  renderBoardHeader(project) {
    document.getElementById('board-project-name').textContent = project.name;
    document.getElementById('board-project-desc').textContent = project.description || '';
    
    // Progress
    const total = project.totalTasks || 0;
    const completed = project.completedTasks || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const progFill = document.getElementById('board-progress-fill');
    const progText = document.getElementById('board-progress-text');
    if (progFill) progFill.style.width = `${progress}%`;
    if (progText) progText.textContent = `${progress}% completed (${completed}/${total})`;

    // Members stack in header
    const membersStack = document.getElementById('board-members-stack');
    if (membersStack) {
      const members = project.members || [];
      membersStack.innerHTML = members.map(m => {
        const u = m.user;
        if (!u) return '';
        return u.profileImage
          ? `<img src="${u.profileImage}" alt="${u.name}" class="avatar avatar-sm" title="${u.name} (${m.role})">`
          : `<span class="avatar avatar-sm avatar-fallback" title="${u.name} (${m.role})">${this.getInitials(u.name)}</span>`;
      }).join('');
    }

    // Show or hide manage members / settings button if owner
    const isOwner = project.owner?._id === this.currentUser?._id;
    const manageBtn = document.getElementById('btn-manage-members');
    if (manageBtn) {
      manageBtn.style.display = isOwner ? 'inline-flex' : 'none';
    }
  },

  renderBoardColumns(tasks) {
    const statuses = ['todo', 'in-progress', 'in-review', 'completed'];

    statuses.forEach(status => {
      const colEl = document.getElementById(`kanban-list-${status}`);
      const countEl = document.getElementById(`col-count-${status}`);
      if (!colEl) return;

      const colTasks = tasks.filter(t => t.status === status);
      if (countEl) countEl.textContent = colTasks.length;

      colEl.innerHTML = '';
      if (colTasks.length === 0) {
        colEl.innerHTML = `<div class="kanban-empty-placeholder">Drop tasks here</div>`;
      } else {
        colTasks.forEach(task => {
          colEl.appendChild(this.buildTaskCardElement(task));
        });
      }
    });
  },

  buildTaskCardElement(task) {
    const card = document.createElement('div');
    card.id = `task-card-${task._id}`;
    card.className = `task-card priority-${task.priority}`;
    card.draggable = true;
    card.dataset.taskId = task._id;
    card.dataset.status = task.status;

    const assignee = task.assignedTo;
    const commentCount = task.commentCount || 0;
    const dueDateStr = task.dueDate ? this.formatShortDate(task.dueDate) : '';

    card.innerHTML = `
      <div class="task-card-header">
        <span class="badge priority-${task.priority}">${task.priority}</span>
        ${dueDateStr ? `<span class="task-due-date" title="Due Date">📅 ${dueDateStr}</span>` : ''}
      </div>
      <h4 class="task-card-title">${this.escapeHTML(task.title)}</h4>
      ${task.description ? `<p class="task-card-snippet">${this.escapeHTML(task.description)}</p>` : ''}
      <div class="task-card-footer">
        <div class="task-assignee-avatar">
          ${assignee
            ? (assignee.profileImage
                ? `<img src="${assignee.profileImage}" alt="${assignee.name}" class="avatar avatar-xs" title="Assigned to ${assignee.name}">`
                : `<span class="avatar avatar-xs avatar-fallback" title="Assigned to ${assignee.name}">${this.getInitials(assignee.name)}</span>`)
            : '<span class="avatar-unassigned" title="Unassigned">👤</span>'
          }
          <span class="assignee-name-sm">${assignee ? assignee.name.split(' ')[0] : 'Unassigned'}</span>
        </div>
        <div class="task-card-metrics">
          <span class="task-comment-count" title="${commentCount} comments">💬 ${commentCount}</span>
        </div>
      </div>
    `;

    // Click opens task details modal
    card.addEventListener('click', () => {
      this.openTaskDetailModal(task._id);
    });

    // Native Drag events
    card.addEventListener('dragstart', (e) => {
      this.draggedTaskId = task._id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task._id);
    });

    card.addEventListener('dragend', () => {
      this.draggedTaskId = null;
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
    });

    return card;
  },

  setupKanbanDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-column');

    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
        const targetStatus = col.dataset.status;

        if (!taskId || !targetStatus) return;

        const card = document.getElementById(`task-card-${taskId}`);
        if (!card) return;

        const currentStatus = card.dataset.status;
        if (currentStatus === targetStatus) return;

        // Optimistic UI move
        const list = col.querySelector('.kanban-tasks-list');
        const emptyPlaceholder = list.querySelector('.kanban-empty-placeholder');
        if (emptyPlaceholder) emptyPlaceholder.remove();

        card.dataset.status = targetStatus;
        list.appendChild(card);
        this.updateProjectStatsDOM();

        try {
          await API.updateTaskStatus(taskId, targetStatus, 0);
          this.showToast(`Task moved to ${this.formatStatus(targetStatus)}`, 'success');
        } catch (err) {
          this.showToast('Failed to update task status: ' + err.message, 'error');
          // Reload board to restore state
          if (this.currentProject) {
            this.loadProjectBoard(this.currentProject._id);
          }
        }
      });
    });
  },

  renderTaskCard(task) {
    const list = document.getElementById(`kanban-list-${task.status}`);
    if (list) {
      const placeholder = list.querySelector('.kanban-empty-placeholder');
      if (placeholder) placeholder.remove();
      list.appendChild(this.buildTaskCardElement(task));
    }
  },

  updateTaskCardDOM(task) {
    const oldCard = document.getElementById(`task-card-${task._id}`);
    if (oldCard) {
      const newCard = this.buildTaskCardElement(task);
      oldCard.replaceWith(newCard);
    }
  },

  moveTaskCardDOM(task) {
    const card = document.getElementById(`task-card-${task._id}`);
    const targetList = document.getElementById(`kanban-list-${task.status}`);

    if (card && targetList) {
      const placeholder = targetList.querySelector('.kanban-empty-placeholder');
      if (placeholder) placeholder.remove();
      card.dataset.status = task.status;
      targetList.appendChild(card);
    }
  },

  updateProjectStatsDOM() {
    const statuses = ['todo', 'in-progress', 'in-review', 'completed'];
    let total = 0;
    let completed = 0;

    statuses.forEach(status => {
      const list = document.getElementById(`kanban-list-${status}`);
      const countEl = document.getElementById(`col-count-${status}`);
      if (list) {
        const cards = list.querySelectorAll('.task-card');
        const count = cards.length;
        if (countEl) countEl.textContent = count;
        total += count;
        if (status === 'completed') completed += count;
      }
    });

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const progFill = document.getElementById('board-progress-fill');
    const progText = document.getElementById('board-progress-text');
    if (progFill) progFill.style.width = `${progress}%`;
    if (progText) progText.textContent = `${progress}% completed (${completed}/${total})`;
  },

  // ----------------------------------------------------
  // TASK DETAILS & COMMENTS MODAL
  // ----------------------------------------------------
  async openTaskDetailModal(taskId) {
    this.activeTaskId = taskId;
    const modal = document.getElementById('task-detail-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    try {
      const [taskRes, commentsRes] = await Promise.all([
        API.getTask(taskId),
        API.getTaskComments(taskId)
      ]);

      const task = taskRes.data?.task;
      const comments = commentsRes.data?.comments || [];

      if (!task) throw new Error('Task not found');

      this.fillTaskDetailModal(task);
      this.renderCommentsList(comments);
    } catch (err) {
      this.showToast('Failed to load task details: ' + err.message, 'error');
      modal.classList.add('hidden');
    }
  },

  fillTaskDetailModal(task) {
    document.getElementById('task-detail-title').textContent = task.title;
    document.getElementById('task-detail-desc').textContent = task.description || 'No description provided.';
    document.getElementById('task-detail-priority').textContent = task.priority;
    document.getElementById('task-detail-priority').className = `badge priority-${task.priority}`;
    document.getElementById('task-detail-status').textContent = this.formatStatus(task.status);
    document.getElementById('task-detail-status').className = `badge status-${task.status}`;

    // Status changer select
    const statusSelect = document.getElementById('task-detail-status-select');
    if (statusSelect) {
      statusSelect.value = task.status;
      statusSelect.onchange = async () => {
        const newStatus = statusSelect.value;
        try {
          await API.updateTaskStatus(task._id, newStatus);
          this.showToast(`Status updated to ${this.formatStatus(newStatus)}`, 'success');
        } catch (err) {
          this.showToast('Failed to update status: ' + err.message, 'error');
        }
      };
    }

    // Populate assignee dropdown with project members
    const assignSelect = document.getElementById('task-detail-assign-select');
    if (assignSelect && this.currentProject) {
      const members = this.currentProject.members || [];
      assignSelect.innerHTML = '<option value="">Unassigned</option>' +
        members.map(m => {
          const u = m.user;
          if (!u) return '';
          const selected = task.assignedTo?._id === u._id ? 'selected' : '';
          return `<option value="${u._id}" ${selected}>${u.name} (${u.username})</option>`;
        }).join('');

      assignSelect.onchange = async () => {
        const newUserId = assignSelect.value;
        try {
          await API.assignTask(task._id, newUserId);
          this.showToast('Task assignment updated', 'success');
        } catch (err) {
          this.showToast('Failed to assign task: ' + err.message, 'error');
        }
      };
    }

    // Due date
    const dueEl = document.getElementById('task-detail-due');
    if (dueEl) {
      dueEl.textContent = task.dueDate ? this.formatDate(task.dueDate) : 'No due date';
    }

    // Created by
    const creatorEl = document.getElementById('task-detail-creator');
    if (creatorEl) {
      creatorEl.textContent = task.createdBy ? task.createdBy.name : 'Unknown';
    }
  },

  renderCommentsList(comments) {
    const list = document.getElementById('task-comments-list');
    if (!list) return;

    if (comments.length === 0) {
      list.innerHTML = '<div class="no-comments-msg">No comments yet. Start the conversation!</div>';
      return;
    }

    list.innerHTML = comments.map(c => this.createCommentHTML(c)).join('');
  },

  createCommentHTML(c) {
    const isOwner = c.user?._id === this.currentUser?._id;
    return `
      <div class="comment-item" id="comment-${c._id}">
        <div class="comment-avatar">
          ${c.user?.profileImage
            ? `<img src="${c.user.profileImage}" alt="${c.user.name}" class="avatar avatar-sm">`
            : `<span class="avatar avatar-sm avatar-fallback">${this.getInitials(c.user?.name)}</span>`
          }
        </div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-author">${this.escapeHTML(c.user?.name || 'User')}</span>
            <span class="comment-time">${this.timeAgo(c.createdAt)}</span>
            ${isOwner ? `<button class="btn-delete-comment" onclick="App.handleDeleteComment('${c._id}')" title="Delete comment">&times;</button>` : ''}
          </div>
          <div class="comment-text">${this.escapeHTML(c.text)}</div>
        </div>
      </div>
    `;
  },

  appendCommentDOM(comment) {
    const list = document.getElementById('task-comments-list');
    if (!list) return;

    const empty = list.querySelector('.no-comments-msg');
    if (empty) empty.remove();

    list.insertAdjacentHTML('beforeend', this.createCommentHTML(comment));
    list.scrollTop = list.scrollHeight;
  },

  async handleAddComment(e) {
    e.preventDefault();
    if (!this.activeTaskId) return;

    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    try {
      await API.addComment(this.activeTaskId, text);
    } catch (err) {
      this.showToast('Failed to post comment: ' + err.message, 'error');
    }
  },

  async handleDeleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await API.deleteComment(commentId);
      this.showToast('Comment deleted', 'info');
    } catch (err) {
      this.showToast('Failed to delete comment: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------
  // CREATE TASK MODAL
  // ----------------------------------------------------
  openCreateTaskModal(defaultStatus = 'todo') {
    if (!this.currentProject) {
      this.showToast('Please open a project board first', 'warning');
      return;
    }

    const modal = document.getElementById('create-task-modal');
    if (!modal) return;

    // Populate assignee select with project members
    const assignSelect = document.getElementById('task-assignee');
    if (assignSelect) {
      const members = this.currentProject.members || [];
      assignSelect.innerHTML = '<option value="">Unassigned</option>' +
        members.map(m => {
          const u = m.user;
          if (!u) return '';
          return `<option value="${u._id}">${u.name} (${u.username})</option>`;
        }).join('');
    }

    // Set default status
    const statusSelect = document.getElementById('task-status');
    if (statusSelect) {
      statusSelect.value = defaultStatus;
    }

    modal.classList.remove('hidden');
    document.getElementById('task-title').focus();
  },

  async handleCreateTask(e) {
    e.preventDefault();
    if (!this.currentProject) return;

    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const assignedTo = document.getElementById('task-assignee').value || null;
    const priority = document.getElementById('task-priority').value || 'medium';
    const status = document.getElementById('task-status').value || 'todo';
    const dueDate = document.getElementById('task-due-date').value || null;
    const submitBtn = document.getElementById('create-task-submit-btn');

    if (!title) {
      this.showToast('Task title is required', 'warning');
      return;
    }

    Auth.setLoading(submitBtn, true, 'Creating...');

    try {
      const res = await API.createTask(this.currentProject._id, {
        title,
        description,
        assignedTo,
        priority,
        status,
        dueDate
      });

      if (res.success) {
        this.showToast('Task created successfully!', 'success');
        document.getElementById('create-task-modal').classList.add('hidden');
        document.getElementById('create-task-form').reset();
      }
    } catch (err) {
      this.showToast('Failed to create task: ' + err.message, 'error');
    } finally {
      Auth.setLoading(submitBtn, false, 'Create Task');
    }
  },

  async handleDeleteTask() {
    if (!this.activeTaskId) return;
    if (!confirm('Are you sure you want to permanently delete this task?')) return;

    try {
      await API.deleteTask(this.activeTaskId);
      this.showToast('Task deleted successfully', 'success');
      document.getElementById('task-detail-modal').classList.add('hidden');
    } catch (err) {
      this.showToast('Failed to delete task: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------
  // PROJECT MEMBERS MANAGEMENT MODAL
  // ----------------------------------------------------
  async openMembersModal() {
    if (!this.currentProject) return;
    const modal = document.getElementById('members-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    this.renderMembersListInModal();

    // Populate user search autocomplete for adding new members
    try {
      const usersRes = await API.getUsers();
      const allUsers = usersRes.data?.users || [];
      const currentMemberIds = (this.currentProject.members || []).map(m => m.user?._id);

      const addSelect = document.getElementById('select-new-member');
      if (addSelect) {
        const available = allUsers.filter(u => !currentMemberIds.includes(u._id));
        if (available.length === 0) {
          addSelect.innerHTML = '<option value="">All users are already in this project</option>';
        } else {
          addSelect.innerHTML = '<option value="">Select a user to invite...</option>' +
            available.map(u => `<option value="${u._id}">${u.name} (${u.email})</option>`).join('');
        }
      }
    } catch (err) {
      console.warn('Failed to load users for invitation:', err);
    }
  },

  renderMembersListInModal() {
    const list = document.getElementById('project-members-modal-list');
    if (!list || !this.currentProject) return;

    const members = this.currentProject.members || [];
    const isOwner = this.currentProject.owner?._id === this.currentUser?._id;

    list.innerHTML = members.map(m => {
      const u = m.user;
      if (!u) return '';
      const isMemberOwner = m.role === 'owner';

      return `
        <div class="member-list-item">
          <div class="member-item-info">
            ${u.profileImage
              ? `<img src="${u.profileImage}" alt="${u.name}" class="avatar avatar-sm">`
              : `<span class="avatar avatar-sm avatar-fallback">${this.getInitials(u.name)}</span>`
            }
            <div>
              <div class="member-name">${this.escapeHTML(u.name)}</div>
              <div class="member-sub">${this.escapeHTML(u.email || u.username)}</div>
            </div>
          </div>
          <div class="member-actions">
            <span class="badge ${isMemberOwner ? 'badge-owner' : 'badge-member'}">${m.role}</span>
            ${isOwner && !isMemberOwner ? `
              <button class="btn btn-danger btn-xs" onclick="App.handleRemoveMember('${u._id}')">Remove</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async handleAddMember(e) {
    e.preventDefault();
    if (!this.currentProject) return;

    const select = document.getElementById('select-new-member');
    const userId = select.value;
    if (!userId) {
      this.showToast('Please select a user to add', 'warning');
      return;
    }

    try {
      const res = await API.addProjectMember(this.currentProject._id, userId);
      if (res.success) {
        this.currentProject = res.data.project;
        this.showToast('Member added successfully!', 'success');
        this.openMembersModal(); // Refresh list
        this.renderBoardHeader(this.currentProject);
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleRemoveMember(userId) {
    if (!this.currentProject) return;
    if (!confirm('Are you sure you want to remove this member from the project?')) return;

    try {
      await API.removeProjectMember(this.currentProject._id, userId);
      this.showToast('Member removed', 'info');
      // Refresh project
      const projRes = await API.getProject(this.currentProject._id);
      this.currentProject = projRes.data.project;
      this.openMembersModal();
      this.renderBoardHeader(this.currentProject);
    } catch (err) {
      this.showToast('Failed to remove member: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------
  // ALL TASKS VIEW
  // ----------------------------------------------------
  async loadAllTasksView() {
    try {
      const res = await API.getAllTasks();
      this.allTasks = res.data?.tasks || [];
      this.renderAllTasksTable(this.allTasks);

      // Bind filter buttons
      document.querySelectorAll('[data-task-filter]').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('[data-task-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.taskFilter;
          this.filterAllTasks(filter);
        };
      });
    } catch (err) {
      this.showToast('Failed to load tasks: ' + err.message, 'error');
    }
  },

  filterAllTasks(filter) {
    let filtered = [...this.allTasks];
    if (filter === 'assigned') {
      filtered = filtered.filter(t => t.assignedTo?._id === this.currentUser?._id);
    } else if (filter === 'created') {
      filtered = filtered.filter(t => t.createdBy?._id === this.currentUser?._id);
    } else if (filter === 'completed') {
      filtered = filtered.filter(t => t.status === 'completed');
    } else if (filter === 'urgent') {
      filtered = filtered.filter(t => t.priority === 'urgent' || t.priority === 'high');
    }
    this.renderAllTasksTable(filtered);
  },

  renderAllTasksTable(tasks) {
    const container = document.getElementById('all-tasks-table-container');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No tasks found matching filter.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="tasks-table">
        <div class="tasks-table-header">
          <span>Task</span>
          <span>Project</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Assigned To</span>
          <span>Due Date</span>
        </div>
        ${tasks.map(t => `
          <div class="tasks-table-row" onclick="App.openTaskDetailModal('${t._id}')">
            <span class="cell-title">${this.escapeHTML(t.title)}</span>
            <span class="cell-project">${this.escapeHTML(t.project?.name || 'Project')}</span>
            <span><span class="badge status-${t.status}">${this.formatStatus(t.status)}</span></span>
            <span><span class="badge priority-${t.priority}">${t.priority}</span></span>
            <span class="cell-assignee">${t.assignedTo ? t.assignedTo.name : 'Unassigned'}</span>
            <span class="cell-due">${t.dueDate ? this.formatShortDate(t.dueDate) : '-'}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ----------------------------------------------------
  // MEMBERS DIRECTORY VIEW
  // ----------------------------------------------------
  async loadMembersView() {
    try {
      const res = await API.getUsers();
      const users = res.data?.users || [];
      const grid = document.getElementById('members-directory-grid');
      if (!grid) return;

      grid.innerHTML = users.map(u => `
        <div class="user-profile-card">
          <div class="user-card-avatar">
            ${u.profileImage
              ? `<img src="${u.profileImage}" alt="${u.name}" class="avatar avatar-lg">`
              : `<span class="avatar avatar-lg avatar-fallback">${this.getInitials(u.name)}</span>`
            }
          </div>
          <h4 class="user-card-name">${this.escapeHTML(u.name)}</h4>
          <p class="user-card-username">@${this.escapeHTML(u.username)}</p>
          <p class="user-card-bio">${this.escapeHTML(u.bio || 'TaskFlow team member')}</p>
          <div class="user-card-footer">
            <span class="badge badge-email">${this.escapeHTML(u.email)}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      this.showToast('Failed to load team members: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------
  // USER PROFILE MODAL
  // ----------------------------------------------------
  openProfileModal() {
    const user = this.currentUser;
    if (!user) return;

    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    document.getElementById('profile-name-input').value = user.name || '';
    document.getElementById('profile-bio-input').value = user.bio || '';
    document.getElementById('profile-image-input').value = user.profileImage || '';

    modal.classList.remove('hidden');
  },

  async handleUpdateProfile(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const name = document.getElementById('profile-name-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const profileImage = document.getElementById('profile-image-input').value.trim();
    const submitBtn = document.getElementById('save-profile-btn');

    Auth.setLoading(submitBtn, true, 'Saving...');

    try {
      const res = await API.updateProfile(this.currentUser._id, { name, bio, profileImage });
      if (res.success && res.data) {
        this.currentUser = res.data.user;
        API.setCurrentUser(this.currentUser);
        this.updateUserUI(this.currentUser);
        this.showToast('Profile updated successfully!', 'success');
        document.getElementById('profile-modal').classList.add('hidden');
      }
    } catch (err) {
      this.showToast('Failed to update profile: ' + err.message, 'error');
    } finally {
      Auth.setLoading(submitBtn, false, 'Save Changes');
    }
  },

  // ----------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------
  async loadNotifications() {
    try {
      const res = await API.getNotifications();
      this.notifications = res.data?.notifications || [];
      this.unreadNotificationsCount = res.data?.unreadCount || 0;
      this.renderNotificationBadge();
      this.renderNotificationsList();
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  },

  renderNotificationBadge() {
    const badge = document.getElementById('notification-unread-count');
    if (badge) {
      if (this.unreadNotificationsCount > 0) {
        badge.textContent = this.unreadNotificationsCount > 9 ? '9+' : this.unreadNotificationsCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  },

  renderNotificationsList() {
    const list = document.getElementById('notification-items-list');
    if (!list) return;

    if (this.notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
      return;
    }

    list.innerHTML = this.notifications.map(n => `
      <div class="notification-item ${n.isRead ? 'read' : 'unread'}" onclick="App.handleNotificationClick('${n._id}', '${n.project?._id || ''}', '${n.task?._id || ''}')">
        <div class="notification-icon">
          ${this.getNotificationIcon(n.type)}
        </div>
        <div class="notification-body">
          <p class="notification-msg">${this.escapeHTML(n.message)}</p>
          <span class="notification-time">${this.timeAgo(n.createdAt)}</span>
        </div>
        ${!n.isRead ? '<span class="unread-dot"></span>' : ''}
      </div>
    `).join('');
  },

  getNotificationIcon(type) {
    switch (type) {
      case 'task_assigned': return '📋';
      case 'task_status_changed': return '🔄';
      case 'comment_added': return '💬';
      case 'member_added': return '👥';
      case 'member_removed': return '🚫';
      default: return '🔔';
    }
  },

  async handleNotificationClick(id, projectId, taskId) {
    try {
      await API.markNotificationRead(id);
      const notif = this.notifications.find(n => n._id === id);
      if (notif && !notif.isRead) {
        notif.isRead = true;
        this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1);
        this.renderNotificationBadge();
        this.renderNotificationsList();
      }

      // Navigate to project/task if applicable
      if (projectId) {
        this.switchView('board', projectId);
        if (taskId) {
          setTimeout(() => this.openTaskDetailModal(taskId), 300);
        }
      }
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  },

  async markAllNotificationsRead() {
    try {
      await API.markAllNotificationsRead();
      this.notifications.forEach(n => n.isRead = true);
      this.unreadNotificationsCount = 0;
      this.renderNotificationBadge();
      this.renderNotificationsList();
      this.showToast('All notifications marked as read', 'info');
    } catch (err) {
      this.showToast('Failed to mark all as read: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------
  // GLOBAL SEARCH
  // ----------------------------------------------------
  handleGlobalSearch(query) {
    if (!query) {
      if (this.currentView === 'projects') this.renderProjectsGrid(this.allProjects);
      if (this.currentView === 'tasks') this.renderAllTasksTable(this.allTasks);
      return;
    }

    const q = query.toLowerCase();

    if (this.currentView === 'projects') {
      const filtered = this.allProjects.filter(p =>
        p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
      this.renderProjectsGrid(filtered);
    } else if (this.currentView === 'board') {
      document.querySelectorAll('.task-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'block' : 'none';
      });
    } else if (this.currentView === 'tasks') {
      const filtered = this.allTasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.project?.name && t.project.name.toLowerCase().includes(q))
      );
      this.renderAllTasksTable(filtered);
    }
  },

  // ----------------------------------------------------
  // TOAST NOTIFICATIONS
  // ----------------------------------------------------
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '•'}</span>
      <span class="toast-message">${this.escapeHTML(message)}</span>
      <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').onclick = () => toast.remove();

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatStatus(status) {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in-progress': return 'In Progress';
      case 'in-review': return 'In Review';
      case 'completed': return 'Completed';
      default: return status;
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return this.formatShortDate(dateStr);
  }
};

// Auto boot on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  Auth.init();
});
