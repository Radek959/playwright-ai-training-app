# Playwright Training App - Complete Test Plan

## Application Overview

Comprehensive test plan for a task management application with dashboard analytics, task management, and user administration features. The application includes real-time statistics, multiple task views, and team collaboration functionality.

## Test Scenarios

### 1. Dashboard Functionality

**Seed:** `tests/seeds/dashboard-seed.spec.ts`

#### 1.1. Dashboard displays correct statistics

**File:** `tests/dashboard/dashboard-statistics.spec.ts`

**Steps:**
  1. Navigate to the dashboard page
    - expect: Dashboard page loads successfully
    - expect: Page title shows 'Playwright + AI - Training App'
  2. Verify statistics cards display correct data
    - expect: Total Tasks shows correct count and percentage change
    - expect: In Progress shows correct count and trend
    - expect: High Priority shows accurate count
    - expect: Completion percentage is calculated correctly
  3. Check task status distribution chart
    - expect: To Do shows correct count and percentage
    - expect: In Progress shows correct count and percentage
    - expect: Done shows correct count and percentage
    - expect: Percentages add up to 100%
  4. Verify priority breakdown chart
    - expect: Low priority shows correct count with downward arrow
    - expect: Medium priority shows correct count with neutral arrow
    - expect: High priority shows correct count with upward arrow
  5. Check team overview section
    - expect: Shows correct number of active members
    - expect: All team members are displayed with avatars/initials
    - expect: Names are correctly displayed

#### 1.2. Dashboard updates with data changes

**File:** `tests/dashboard/dashboard-real-time-updates.spec.ts`

**Steps:**
  1. Record initial dashboard statistics
    - expect: Initial statistics are captured correctly
  2. Navigate to Tasks and create a new task
    - expect: New task is created successfully
  3. Return to Dashboard and verify updated statistics
    - expect: Total Tasks count has increased
    - expect: Status distribution reflects the new task
    - expect: Priority breakdown is updated if high priority task was added
  4. Change a task status from To Do to In Progress
    - expect: Dashboard In Progress count increases
    - expect: Task Status Distribution updates correctly
  5. Mark a task as Done
    - expect: Completion percentage increases
    - expect: Done status count increases
    - expect: Task Status Distribution updates

#### 1.3. Dashboard navigation and layout

**File:** `tests/dashboard/dashboard-navigation.spec.ts`

**Steps:**
  1. Test sidebar navigation
    - expect: Dashboard link is highlighted when on dashboard
    - expect: Navigation to Tasks works
    - expect: Navigation to Users works
    - expect: Return to Dashboard maintains state
  2. Test collapse button functionality
    - expect: Sidebar can be collapsed
    - expect: Sidebar can be expanded
    - expect: Dashboard content adjusts to collapsed state
  3. Verify responsive behavior
    - expect: Dashboard layout adapts to different screen sizes
    - expect: Statistics cards stack appropriately on mobile
    - expect: Charts remain readable on smaller screens

### 2. Task Management

**Seed:** `tests/seeds/task-management-seed.spec.ts`

#### 2.1. Create task using wizard

**File:** `tests/tasks/create-task-wizard.spec.ts`

**Steps:**
  1. Click 'New Task' button
    - expect: Task creation wizard opens
    - expect: Step 1: Basic Information is displayed
  2. Fill Step 1 - leave title empty and try to proceed
    - expect: Next button remains disabled or validation error appears
    - expect: Required field validation works for title
  3. Fill Step 1 with valid data: type='Feature', title='Test Feature', description='Test description', priority='High'
    - expect: All fields accept input correctly
    - expect: Next button becomes enabled
  4. Proceed to Step 2: Assignment and Details
    - expect: Step 2 displays correctly
    - expect: User dropdown shows all available users
    - expect: Optional fields are accessible
  5. Fill Step 2 - leave assignee empty and proceed
    - expect: Validation prevents proceeding without required assignee
    - expect: Error message indicates assignee is required
  6. Complete Step 2 with assignee='Alice Johnson', time=8 hours, due date='2026-05-15', manager approval checked, tags='feature,urgent'
    - expect: All fields accept input
    - expect: Next button is enabled
  7. Review Step 3: Summary
    - expect: All entered data is displayed correctly
    - expect: Warning about non-editable fields is shown
    - expect: Create task button is available
  8. Create the task
    - expect: Task is created successfully
    - expect: User is returned to task list
    - expect: New task appears in the list
    - expect: Dashboard statistics update

#### 2.2. Create task using Quick Add

**File:** `tests/tasks/create-task-quick-add.spec.ts`

**Steps:**
  1. Click 'Quick Add' button
    - expect: Quick Add form expands
    - expect: Button text changes to 'Hide Add'
  2. Submit empty Quick Add form
    - expect: Validation prevents submission
    - expect: Required fields are highlighted
  3. Fill Quick Add form with title='Quick Task', description='Quick description', status='In Progress', priority='Medium', due date='2026-06-01', assignee='Bob Smith'
    - expect: All fields accept input correctly
    - expect: Add task button is enabled
  4. Submit the Quick Add form
    - expect: Task is created successfully
    - expect: Form clears after submission
    - expect: New task appears in task list
    - expect: Dashboard updates
  5. Click 'Hide Add' to close form
    - expect: Quick Add form collapses
    - expect: Button text returns to 'Quick Add'

#### 2.3. Task list views and filtering

**File:** `tests/tasks/task-views-filtering.spec.ts`

**Steps:**
  1. Test Grid View (default)
    - expect: Tasks display as cards
    - expect: Each card shows title, description, status, priority, due date, owner
    - expect: Edit and Delete buttons are visible
  2. Switch to Table view
    - expect: Tasks display in table format
    - expect: Columns show Title, Status, Priority, Due Date, Assigned, Actions
    - expect: Table is sortable by clicking headers
    - expect: Inline editing dropdowns work
  3. Test search functionality
    - expect: Search box accepts input
    - expect: Results filter based on title and description
    - expect: Search results update in real-time
    - expect: Clear search returns all tasks
  4. Test view filters: All, My Tasks, Unassigned
    - expect: All shows all tasks
    - expect: My Tasks shows only current user's tasks
    - expect: Unassigned shows tasks with no assignee
  5. Test status filter dropdown
    - expect: Status: All shows all tasks
    - expect: Specific status filters work correctly
    - expect: Filtering combines with other filters
  6. Test priority filter dropdown
    - expect: Priority: All shows all tasks
    - expect: Specific priority filters work correctly
    - expect: Multiple filters work together

#### 2.4. Task editing and management

**File:** `tests/tasks/task-edit-management.spec.ts`

**Steps:**
  1. Click Edit button on a task in Grid view
    - expect: Edit form opens with current task data
    - expect: All fields are pre-populated
    - expect: Form validation works for required fields
  2. Modify task details and save
    - expect: Changes are saved successfully
    - expect: Updated task displays new information
    - expect: Dashboard statistics update if status/priority changed
  3. Test inline editing in Table view
    - expect: Status dropdown changes save immediately
    - expect: Priority dropdown changes save immediately
    - expect: Assignee dropdown changes save immediately
    - expect: Due date changes save on blur
  4. Test task deletion
    - expect: Delete confirmation appears
    - expect: Confirming deletion removes task from list
    - expect: Dashboard statistics update
    - expect: Canceling deletion preserves task
  5. Test bulk operations in Table view
    - expect: Checkboxes allow multiple task selection
    - expect: Bulk actions become available
    - expect: Bulk delete works correctly

#### 2.5. Task tabs and advanced features

**File:** `tests/tasks/task-tabs-features.spec.ts`

**Steps:**
  1. Test Active tab
    - expect: Shows only non-completed tasks
    - expect: Task counts are accurate
  2. Test Archive tab
    - expect: Shows completed tasks
    - expect: Archived tasks maintain their data
  3. Test Analytics tab
    - expect: Analytics view displays task metrics
    - expect: Charts and graphs are rendered
    - expect: Data is accurate and up-to-date
  4. Test pagination
    - expect: Pagination controls work when more tasks exist
    - expect: Page information is accurate
    - expect: Navigation between pages preserves filters

### 3. User Management

**Seed:** `tests/seeds/user-management-seed.spec.ts`

#### 3.1. View and manage users

**File:** `tests/users/user-management.spec.ts`

**Steps:**
  1. Navigate to Users page
    - expect: Users page loads successfully
    - expect: Existing users are displayed in table
    - expect: Add user form is visible
  2. Verify user table displays correct information
    - expect: User avatars/initials display correctly
    - expect: Names are shown properly
    - expect: Email addresses are visible
    - expect: Roles (admin, editor, viewer) are displayed
    - expect: Status shows as Active
  3. Test user form validation - submit empty form
    - expect: Form validation prevents submission
    - expect: Required fields are highlighted
    - expect: Error messages are displayed
  4. Add new user with valid data: name='Test User', email='test@example.com', role='Editor', avatar='https://example.com/avatar.jpg'
    - expect: User is added successfully
    - expect: New user appears in table
    - expect: Form clears after submission
    - expect: User is available in task assignment dropdowns
  5. Test email validation
    - expect: Invalid email formats are rejected
    - expect: Valid email formats are accepted
  6. Test role dropdown functionality
    - expect: All roles (Admin, Editor, Viewer) are available
    - expect: Default role is selected correctly
    - expect: Role changes are saved

### 4. Integration and Cross-Feature

**Seed:** `tests/seeds/integration-seed.spec.ts`

#### 4.1. End-to-end workflow

**File:** `tests/integration/complete-workflow.spec.ts`

**Steps:**
  1. Start with clean Dashboard state
    - expect: Dashboard shows initial statistics
    - expect: All components load correctly
  2. Add new user via Users page
    - expect: User is created successfully
    - expect: Team overview updates
  3. Create task assigned to new user via wizard
    - expect: Task creation includes new user in dropdown
    - expect: Task is created and assigned correctly
  4. Verify Dashboard reflects changes
    - expect: Statistics update with new task
    - expect: Team member count increases
    - expect: Status and priority distributions update
  5. Change task status and priority via Table view
    - expect: Inline edits save successfully
    - expect: Dashboard analytics update in real-time
  6. Complete the task lifecycle
    - expect: Task progression from To Do → In Progress → Done works
    - expect: Each status change updates Dashboard
    - expect: Completion percentage increases

#### 4.2. Error handling and edge cases

**File:** `tests/integration/error-handling.spec.ts`

**Steps:**
  1. Test form validation across all forms
    - expect: Required field validation works consistently
    - expect: Input format validation is enforced
    - expect: Error messages are clear and helpful
  2. Test maximum input lengths
    - expect: Long task titles are handled appropriately
    - expect: Descriptions handle large amounts of text
    - expect: UI remains functional with edge case data
  3. Test date handling
    - expect: Past due dates are handled correctly
    - expect: Invalid date formats are rejected
    - expect: Date displays are consistent across views
  4. Test navigation edge cases
    - expect: Direct URL navigation works
    - expect: Browser back/forward buttons work correctly
    - expect: Page refresh maintains state appropriately
