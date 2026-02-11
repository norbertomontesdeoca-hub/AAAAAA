
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, Project, ViewType, Priority } from './types';
import { DEFAULT_PROJECTS, ICONS, PRIORITY_COLORS } from './constants';
import { parseNaturalLanguageTask, getSmartProductivityTip, refineTaskDescription } from './services/geminiService';

const App: React.FC = () => {
  // Core State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  
  // AI State
  const [productivityTip, setProductivityTip] = useState<string>('Analizando tu productividad...');
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Form State
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(Priority.P4);
  const [newTaskProject, setNewTaskProject] = useState('inbox');

  // Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#246fe0');

  // Persistence & Initial AI Load
  useEffect(() => {
    const savedTasks = localStorage.getItem('gentask_tasks');
    const savedProjects = localStorage.getItem('gentask_projects');
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    
    const timer = setTimeout(() => refreshTip(), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('gentask_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('gentask_projects', JSON.stringify(projects));
  }, [projects]);

  const refreshTip = async () => {
    const pending = tasks.filter(t => !t.isCompleted);
    const tip = await getSmartProductivityTip(pending);
    setProductivityTip(tip);
  };

  // Handlers
  const addTask = (data: Partial<Task>) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      content: data.content || 'Sin título',
      description: data.description || '',
      dueDate: data.dueDate,
      priority: data.priority || Priority.P4,
      projectId: data.projectId || 'inbox',
      isCompleted: false,
      createdAt: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
    setIsAddTaskModalOpen(false);
    resetForm();
  };

  const addProject = () => {
    if (!newProjectName) return;
    const newProj: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProjectName,
      color: newProjectColor
    };
    setProjects(prev => [...prev, newProj]);
    setIsProjectModalOpen(false);
    setNewProjectName('');
  };

  const resetForm = () => {
    setNewTaskInput('');
    setNewTaskDescription('');
    setNewTaskDate('');
    setNewTaskPriority(Priority.P4);
    setNewTaskProject('inbox');
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Tu navegador no soporta dictado por voz.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.start();
    setIsListening(true);

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setNewTaskInput(text);
      setIsListening(false);
      // Auto-parse after voice
      setAiLoading(true);
      const parsed = await parseNaturalLanguageTask(text, projects);
      if (parsed) {
        setNewTaskInput(parsed.content);
        if (parsed.description) setNewTaskDescription(parsed.description);
        if (parsed.dueDate) setNewTaskDate(parsed.dueDate);
        if (parsed.priority) setNewTaskPriority(parsed.priority);
        if (parsed.projectId) setNewTaskProject(parsed.projectId);
      }
      setAiLoading(false);
    };

    recognition.onerror = () => setIsListening(false);
  };

  const handleSmartRefine = async () => {
    if (!newTaskInput) return;
    setAiLoading(true);
    const refined = await refineTaskDescription(newTaskInput);
    setNewTaskInput(refined);
    setAiLoading(false);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const deleteTask = (id: string) => {
    if (confirm("¿Eliminar esta tarea?")) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  // Filtered Logic
  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let result = tasks.filter(task => {
      // Filter by View
      const matchesView = 
        currentView === 'inbox' ? task.projectId === 'inbox' :
        currentView === 'today' ? task.dueDate === today :
        currentView === 'upcoming' ? (task.dueDate && task.dueDate > today) :
        task.projectId === currentView;
      
      // Filter by Search
      const matchesSearch = task.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesView && matchesSearch;
    });

    return {
      pending: result.filter(t => !t.isCompleted).sort((a, b) => a.priority - b.priority),
      completed: result.filter(t => t.isCompleted)
    };
  }, [tasks, currentView, searchQuery]);

  const activeProject = useMemo(() => {
    const special = projects.find(p => p.id === currentView);
    if (special) return special;
    return { name: currentView.charAt(0).toUpperCase() + currentView.slice(1), color: '#E44232' };
  }, [currentView, projects]);

  const getProjectColor = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.color || '#e5e7eb';
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden text-[#202020]">
      {/* Mobile Backdrop */}
      {!isSidebarOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/10 z-20 md:hidden" onClick={() => setIsSidebarOpen(true)}></div>}

      {/* Sidebar */}
      <aside className={`bg-[#fafafa] border-r border-gray-200 flex flex-col transition-all duration-300 z-30 ${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full overflow-hidden'}`}>
        <div className="p-4 flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-7 h-7 bg-[#E44232] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md">GT</div>
            <span className="font-bold text-lg tracking-tight">GenTask AI</span>
          </div>

          <nav className="space-y-0.5">
            <SidebarItem active={currentView === 'inbox'} onClick={() => setCurrentView('inbox')} icon={<ICONS.Inbox />} label="Bandeja de entrada" count={tasks.filter(t => t.projectId === 'inbox' && !t.isCompleted).length} />
            <SidebarItem active={currentView === 'today'} onClick={() => setCurrentView('today')} icon={<ICONS.Today />} label="Hoy" count={tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0] && !t.isCompleted).length} />
            <SidebarItem active={currentView === 'upcoming'} onClick={() => setCurrentView('upcoming')} icon={<ICONS.Upcoming />} label="Próximo" />
          </nav>

          <div className="mt-8">
            <div className="flex items-center justify-between px-2 mb-2 group">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Proyectos</h3>
              <button onClick={() => setIsProjectModalOpen(true)} className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors">
                <ICONS.Plus />
              </button>
            </div>
            <div className="space-y-0.5">
              {projects.filter(p => p.id !== 'inbox').map(project => (
                <button
                  key={project.id}
                  onClick={() => setCurrentView(project.id)}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all ${currentView === project.id ? 'bg-[#eee] text-black font-semibold' : 'hover:bg-gray-200 text-gray-600'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: project.color }}></span>
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100 m-4 rounded-xl shadow-sm">
           <div className="flex items-center gap-2 text-[#E44232] mb-1.5">
              <ICONS.Sparkles />
              <span className="text-[10px] font-extrabold uppercase tracking-tighter">AI Insight</span>
           </div>
           <p className="text-[11px] text-gray-600 font-medium leading-relaxed">"{productivityTip}"</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><ICONS.Search /></span>
              <input 
                type="text" 
                placeholder="Buscar tareas..." 
                className="w-full bg-gray-50 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-[#E44232] transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsAddTaskModalOpen(true)} className="bg-[#E44232] hover:bg-[#c53727] text-white p-2 rounded-full md:rounded-lg md:px-4 md:py-1.5 text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-100 transition-all hover:scale-105 active:scale-95">
                <ICONS.Plus />
                <span className="hidden md:inline">Añadir tarea</span>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto py-10 px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
                {activeProject.name}
                {filteredTasks.pending.length > 0 && <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 rounded-full">{filteredTasks.pending.length}</span>}
              </h2>
              <button className="text-gray-400 hover:text-gray-600"><ICONS.More /></button>
            </div>

            {filteredTasks.pending.length === 0 && filteredTasks.completed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-48 h-48 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                  <ICONS.Check />
                </div>
                <h3 className="text-xl font-bold mb-2">¡Todo listo!</h3>
                <p className="text-gray-500 max-w-xs mx-auto">Relájate o añade una nueva tarea para seguir conquistando tu día.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pending Tasks */}
                <div className="space-y-px">
                  {filteredTasks.pending.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      projectColor={getProjectColor(task.projectId)}
                      onToggle={() => toggleTask(task.id)} 
                      onDelete={() => deleteTask(task.id)} 
                    />
                  ))}
                </div>

                {/* Completed Tasks */}
                {filteredTasks.completed.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Completadas</h4>
                    <div className="space-y-px opacity-60">
                      {filteredTasks.completed.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          projectColor={getProjectColor(task.projectId)}
                          onToggle={() => toggleTask(task.id)} 
                          onDelete={() => deleteTask(task.id)} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={() => setIsAddTaskModalOpen(true)}
              className="w-full mt-6 flex items-center gap-3 px-1 group text-gray-400 hover:text-[#E44232] transition-colors py-2 border-t border-transparent hover:border-gray-50"
            >
              <div className="w-5 h-5 flex items-center justify-center rounded-full group-hover:bg-[#E44232] group-hover:text-white transition-all">
                <ICONS.Plus />
              </div>
              <span className="text-sm font-semibold">Añadir tarea</span>
            </button>
          </div>
        </div>
      </main>

      {/* Modals Implementation (Simplified for briefness but robust) */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-20 z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 mx-4">
            <div className="p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <button 
                  onClick={handleVoiceInput}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <ICONS.Mic />
                  {isListening ? 'Escuchando...' : 'Dictar tarea'}
                </button>
                <button 
                  onClick={handleSmartRefine}
                  disabled={!newTaskInput || aiLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#E44232]/10 text-[#E44232] rounded-full text-xs font-bold hover:bg-[#E44232]/20 transition-all disabled:opacity-50"
                >
                  <ICONS.Sparkles />
                  {aiLoading ? 'Procesando...' : 'Mejorar con IA'}
                </button>
              </div>

              <input 
                autoFocus
                type="text" 
                placeholder="Nombre de la tarea" 
                className="w-full text-xl font-bold outline-none mb-2 placeholder:text-gray-300"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
              />
              <textarea 
                placeholder="Descripción (opcional)" 
                className="w-full text-sm outline-none resize-none mb-6 min-h-[80px] text-gray-600 placeholder:text-gray-300"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              />

              <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <input type="date" className="bg-transparent text-xs text-gray-700 outline-none" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} />
                </div>
                
                <select className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 text-xs font-medium outline-none hover:border-gray-200" value={newTaskPriority} onChange={(e) => setNewTaskPriority(Number(e.target.value))}>
                  <option value={Priority.P4}>Prioridad 4</option>
                  <option value={Priority.P3}>Prioridad 3</option>
                  <option value={Priority.P2}>Prioridad 2</option>
                  <option value={Priority.P1}>Prioridad 1</option>
                </select>

                <select className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 text-xs font-medium outline-none hover:border-gray-200" value={newTaskProject} onChange={(e) => setNewTaskProject(e.target.value)}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setIsAddTaskModalOpen(false)} className="px-5 py-2 rounded-lg font-bold text-sm text-gray-500 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button 
                onClick={() => addTask({ content: newTaskInput, description: newTaskDescription, dueDate: newTaskDate, priority: newTaskPriority, projectId: newTaskProject })}
                disabled={!newTaskInput}
                className="px-6 py-2 bg-[#E44232] hover:bg-[#c53727] text-white rounded-lg font-bold text-sm shadow-md shadow-red-100 disabled:opacity-50 transition-all active:scale-95"
              >
                Añadir tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-200 mx-4">
            <h3 className="text-xl font-extrabold mb-6 tracking-tight">Nuevo Proyecto</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Nombre</label>
                <input type="text" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#E44232]/20 focus:border-[#E44232] transition-all" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ej: Viaje a París" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Color</label>
                <div className="flex gap-2">
                  {['#E44232', '#246fe0', '#058527', '#ff9900', '#af38eb', '#ff0000'].map(c => (
                    <button key={c} onClick={() => setNewProjectColor(c)} className={`w-8 h-8 rounded-full transition-transform ${newProjectColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-300' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={addProject} className="px-6 py-2 bg-[#E44232] text-white text-sm font-bold rounded-lg shadow-md hover:bg-[#c53727]">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-components
const SidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all group ${active ? 'bg-[#eee] text-black font-semibold' : 'hover:bg-gray-200 text-gray-600'}`}
  >
    <div className="flex items-center gap-3">
      <span className={`transition-colors ${active ? 'text-[#E44232]' : 'text-gray-400 group-hover:text-gray-600'}`}>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
    {count !== undefined && count > 0 && <span className="text-[11px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded-md">{count}</span>}
  </button>
);

const TaskItem: React.FC<{ task: Task; projectColor: string; onToggle: () => void; onDelete: () => void }> = ({ task, projectColor, onToggle, onDelete }) => {
  const priorityColor = PRIORITY_COLORS[task.priority];
  
  return (
    <div className="flex items-start gap-4 py-3 group hover:bg-gray-50/50 px-2 rounded-xl transition-colors border-b border-gray-50 last:border-0 relative overflow-hidden">
      {/* Barra lateral de Proyecto */}
      <div 
        className="absolute left-0 top-1 bottom-1 w-1 rounded-full transition-opacity opacity-70"
        style={{ backgroundColor: projectColor }}
      />
      
      {/* Círculo de Prioridad / Checkbox */}
      <button 
        onClick={onToggle}
        style={{ 
          borderColor: task.isCompleted ? '#aaa' : priorityColor,
          backgroundColor: !task.isCompleted ? `${priorityColor}15` : 'transparent'
        }}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.isCompleted ? 'bg-gray-400 border-gray-400 shadow-none' : 'hover:scale-110 shadow-sm'}`}
      >
        {task.isCompleted && <ICONS.Check />}
      </button>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium transition-all ${task.isCompleted ? 'line-through text-gray-400' : 'text-[#202020]'}`}>{task.content}</h4>
        {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>}
        <div className="flex items-center gap-3 mt-2">
          {task.dueDate && (
            <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'bg-red-50 text-red-500' : 'text-gray-400 bg-gray-50'}`}>
               <ICONS.Upcoming />
               <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {/* Badge de prioridad visual si se desea reforzar */}
          {!task.isCompleted && task.priority < 4 && (
             <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100" style={{ color: priorityColor }}>
               P{task.priority}
             </span>
          )}
        </div>
      </div>
      
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
         <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-all">
           <ICONS.Trash />
         </button>
      </div>
    </div>
  );
};

export default App;
