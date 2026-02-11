
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, Project, ViewType, Priority } from './types';
import { DEFAULT_PROJECTS, ICONS, PRIORITY_COLORS } from './constants';
import { parseNaturalLanguageTask, getSmartProductivityTip } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [productivityTip, setProductivityTip] = useState<string>('Loading smart tips...');
  const [aiLoading, setAiLoading] = useState(false);

  // Form State
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(Priority.P4);
  const [newTaskProject, setNewTaskProject] = useState('inbox');

  // Initialization
  useEffect(() => {
    const savedTasks = localStorage.getItem('gentask_tasks');
    const savedProjects = localStorage.getItem('gentask_projects');
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    
    refreshTip();
  }, []);

  useEffect(() => {
    localStorage.setItem('gentask_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('gentask_projects', JSON.stringify(projects));
  }, [projects]);

  const refreshTip = async () => {
    const tip = await getSmartProductivityTip(tasks.filter(t => !t.isCompleted));
    setProductivityTip(tip);
  };

  // Handlers
  const addTask = useCallback((taskData: Partial<Task>) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      content: taskData.content || 'Untitled Task',
      description: taskData.description || '',
      dueDate: taskData.dueDate,
      priority: taskData.priority || Priority.P4,
      projectId: taskData.projectId || 'inbox',
      isCompleted: false,
      createdAt: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
    setIsAddTaskModalOpen(false);
    resetForm();
  }, []);

  const resetForm = () => {
    setNewTaskInput('');
    setNewTaskDescription('');
    setNewTaskDate('');
    setNewTaskPriority(Priority.P4);
    setNewTaskProject('inbox');
  };

  const handleAiParse = async () => {
    if (!newTaskInput) return;
    setAiLoading(true);
    const parsed = await parseNaturalLanguageTask(newTaskInput);
    if (parsed) {
      setNewTaskInput(parsed.content);
      if (parsed.description) setNewTaskDescription(parsed.description);
      if (parsed.dueDate) setNewTaskDate(parsed.dueDate);
      if (parsed.priority) setNewTaskPriority(parsed.priority);
    }
    setAiLoading(false);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(task => {
      if (currentView === 'inbox') return task.projectId === 'inbox';
      if (currentView === 'today') return task.dueDate === today;
      if (currentView === 'upcoming') return task.dueDate && task.dueDate > today;
      return task.projectId === currentView;
    }).sort((a, b) => a.priority - b.priority);
  }, [tasks, currentView]);

  const activeProject = useMemo(() => {
    if (['inbox', 'today', 'upcoming'].includes(currentView)) {
      return { name: currentView.charAt(0).toUpperCase() + currentView.slice(1), color: '#db4c3f' };
    }
    return projects.find(p => p.id === currentView) || { name: 'Tasks', color: '#808080' };
  }, [currentView, projects]);

  return (
    <div className="flex h-screen bg-white overflow-hidden text-gray-800">
      {/* Sidebar */}
      <aside className={`bg-[#fafafa] border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#db4c3f] rounded flex items-center justify-center text-white font-bold">G</div>
              <span className="font-bold text-lg">GenTask AI</span>
            </div>
          </div>

          <nav className="space-y-1">
            <SidebarItem active={currentView === 'inbox'} onClick={() => setCurrentView('inbox')} icon={<ICONS.Inbox />} label="Inbox" count={tasks.filter(t => t.projectId === 'inbox' && !t.isCompleted).length} />
            <SidebarItem active={currentView === 'today'} onClick={() => setCurrentView('today')} icon={<ICONS.Today />} label="Today" count={tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0] && !t.isCompleted).length} />
            <SidebarItem active={currentView === 'upcoming'} onClick={() => setCurrentView('upcoming')} icon={<ICONS.Upcoming />} label="Upcoming" />
          </nav>

          <div className="mt-8">
            <div className="flex items-center justify-between px-2 mb-2 group">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Projects</h3>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600">
                <ICONS.Plus />
              </button>
            </div>
            <div className="space-y-1">
              {projects.filter(p => p.id !== 'inbox').map(project => (
                <button
                  key={project.id}
                  onClick={() => setCurrentView(project.id)}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${currentView === project.id ? 'bg-[#eee] text-black font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }}></span>
                  {project.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
             <div className="flex items-center gap-2 text-[#db4c3f] mb-1">
                <ICONS.Sparkles />
                <span className="text-[10px] font-bold uppercase tracking-widest">AI Tip</span>
             </div>
             <p className="text-xs text-gray-600 italic leading-relaxed">"{productivityTip}"</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-12 border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h2 className="font-bold text-xl truncate">{activeProject.name}</h2>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsAddTaskModalOpen(true)} className="bg-[#db4c3f] hover:bg-[#c53727] text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 shadow-sm transition-all">
                <ICONS.Plus />
                <span>Add task</span>
             </button>
             <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
               <ICONS.Settings />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto py-8 px-6">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <img src="https://picsum.photos/seed/todo/200/200" alt="Empty" className="w-32 h-32 object-cover rounded-full mb-6 grayscale" />
                <p className="text-lg font-medium">Nothing to do here yet.</p>
                <p className="text-sm">Enjoy your peace of mind or add a new task.</p>
              </div>
            ) : (
              <div className="space-y-px">
                {filteredTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    onToggle={() => toggleTask(task.id)} 
                    onDelete={() => deleteTask(task.id)} 
                  />
                ))}
              </div>
            )}
            
            <button 
              onClick={() => setIsAddTaskModalOpen(true)}
              className="w-full mt-4 flex items-center gap-3 px-1 group text-gray-400 hover:text-[#db4c3f] transition-colors"
            >
              <div className="w-5 h-5 flex items-center justify-center rounded-full group-hover:bg-[#db4c3f] group-hover:text-white">
                <ICONS.Plus />
              </div>
              <span className="text-sm font-medium">Add task</span>
            </button>
          </div>
        </div>
      </main>

      {/* Add Task Modal */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-20 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden border border-gray-200 mx-4">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <button 
                  onClick={handleAiParse}
                  disabled={!newTaskInput || aiLoading}
                  className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-md text-xs font-bold shadow-sm hover:border-[#db4c3f] hover:text-[#db4c3f] transition-all disabled:opacity-50"
                >
                  <ICONS.Sparkles />
                  {aiLoading ? 'Magic in progress...' : 'AI Parser'}
                </button>
                <p className="text-[10px] text-gray-400 font-medium italic">Example: "Call Jane tomorrow at 10am P1"</p>
              </div>

              <input 
                autoFocus
                type="text" 
                placeholder="Task name" 
                className="w-full text-lg font-bold outline-none mb-1 placeholder:text-gray-300"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
              />
              <textarea 
                placeholder="Description" 
                className="w-full text-sm outline-none resize-none mb-4 min-h-[60px] placeholder:text-gray-300"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              />

              <div className="flex flex-wrap gap-2 items-center mb-4">
                <input 
                  type="date" 
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 outline-none hover:bg-gray-50"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                />
                <select 
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 outline-none hover:bg-gray-50"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(parseInt(e.target.value))}
                >
                  <option value={Priority.P4}>Priority 4</option>
                  <option value={Priority.P3}>Priority 3</option>
                  <option value={Priority.P2}>Priority 2</option>
                  <option value={Priority.P1}>Priority 1</option>
                </select>
                <select 
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 outline-none hover:bg-gray-50"
                  value={newTaskProject}
                  onChange={(e) => setNewTaskProject(e.target.value)}
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-3 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setIsAddTaskModalOpen(false)} className="px-4 py-1.5 rounded font-medium text-sm text-gray-600 hover:bg-gray-200">Cancel</button>
              <button 
                onClick={() => addTask({ content: newTaskInput, description: newTaskDescription, dueDate: newTaskDate, priority: newTaskPriority, projectId: newTaskProject })}
                disabled={!newTaskInput}
                className="px-4 py-1.5 bg-[#db4c3f] hover:bg-[#c53727] text-white rounded font-medium text-sm disabled:opacity-50"
              >
                Add task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
interface SidebarItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors group ${active ? 'bg-[#eee] text-black font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
  >
    <div className="flex items-center gap-3">
      <span className={active ? 'text-[#db4c3f]' : 'text-gray-400 group-hover:text-gray-600'}>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
    {count !== undefined && count > 0 && <span className="text-[10px] text-gray-400 font-bold">{count}</span>}
  </button>
);

const TaskItem: React.FC<{ task: Task; onToggle: () => void; onDelete: () => void }> = ({ task, onToggle, onDelete }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 group">
    <button 
      onClick={onToggle}
      style={{ borderColor: PRIORITY_COLORS[task.priority] }}
      className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.isCompleted ? 'bg-gray-400 border-gray-400' : 'hover:bg-gray-50'}`}
    >
      {task.isCompleted && <ICONS.Check />}
    </button>
    <div className="flex-1 min-w-0">
      <h4 className={`text-sm font-medium truncate ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.content}</h4>
      {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-3 mt-1.5">
        {task.dueDate && (
          <div className="flex items-center gap-1 text-[11px] text-[#db4c3f] font-medium">
             <ICONS.Upcoming />
             <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </div>
    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
       <button onClick={onDelete} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors">
         <ICONS.Trash />
       </button>
    </div>
  </div>
);

export default App;
