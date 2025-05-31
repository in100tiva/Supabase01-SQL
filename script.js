// --- Configuração Supabase ---
        const SUPABASE_URL = 'SUPABASE_URL'; 
        const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY';

        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // --- Elementos do DOM (IDs atualizados para o novo HTML) ---
        const addTodoForm = document.getElementById('addTodoForm'); // O form em si
        const newTaskInput = document.getElementById('newTaskInput'); // Input de texto da tarefa
        const todoList = document.getElementById('todoList');       // UL onde as tarefas são listadas
        const loadingMessage = document.getElementById('loadingMessage');
        const emptyMessage = document.getElementById('emptyMessage');
        const messageModal = document.getElementById('messageModal');
        const addTodoBtn = document.getElementById('addTodoBtn');       // Botão de adicionar tarefa
        const suggestSubtasksBtn = document.getElementById('suggestSubtasksBtn'); // Botão de sugerir subtarefas
        const suggestBtnText = document.getElementById('suggestBtnText');
        const suggestBtnLoading = document.getElementById('suggestBtnLoading');

        // --- Funções Auxiliares ---
        function showMessage(message, type = 'success', duration = 3000) {
            if (messageModal) {
                messageModal.textContent = message;
                messageModal.className = `message-modal ${type} show`;
                setTimeout(() => {
                    messageModal.classList.remove('show');
                }, duration);
            } else {
                console.error("Elemento messageModal não encontrado. Mensagem:", message);
            }
        }

        function setSuggestButtonLoading(isLoading) {
            if (suggestSubtasksBtn && suggestBtnText && suggestBtnLoading) {
                if (isLoading) {
                    suggestSubtasksBtn.disabled = true;
                    suggestBtnText.classList.add('hidden'); // Esconde texto normal
                    suggestBtnLoading.classList.remove('hidden'); // Mostra "..."
                } else {
                    suggestSubtasksBtn.disabled = false;
                    suggestBtnText.classList.remove('hidden'); // Mostra texto normal
                    suggestBtnLoading.classList.add('hidden'); // Esconde "..."
                }
            }
        }
        
        // --- Lógica Principal (Supabase & UI) ---
        async function fetchTodos() {
            if (!supabaseClient || SUPABASE_URL === 'SUA_SUPABASE_URL' || SUPABASE_URL === '' ) {
                if (loadingMessage) loadingMessage.textContent = 'Supabase não configurado corretamente.';
                if(emptyMessage) emptyMessage.classList.add('hidden');
                if (SUPABASE_URL === 'SUA_SUPABASE_URL' || SUPABASE_URL === '') {
                     showMessage('Por favor, configure suas credenciais do Supabase no script JavaScript!', 'error', 7000);
                }
                return;
            }

            if (loadingMessage) loadingMessage.classList.remove('hidden');
            if (emptyMessage) emptyMessage.classList.add('hidden');
            if (todoList) todoList.innerHTML = ''; 

            try {
                const { data: todos, error } = await supabaseClient
                    .from('todos')
                    .select('*')
                    .order('created_at', { ascending: true }); // MUDADO: Tarefas mais antigas primeiro para ordem natural

                if (error) throw error; 

                if (todos && todos.length > 0) {
                    todos.forEach(todo => renderTodoItem(todo, false)); // false para prepend
                    if (emptyMessage) emptyMessage.classList.add('hidden');
                } else {
                    if (emptyMessage) emptyMessage.classList.remove('hidden'); 
                }
            } catch (err) {
                console.error('Erro ao buscar tarefas:', err);
                showMessage(`Erro ao buscar tarefas: ${err.message || 'Erro desconhecido'}`, 'error');
                if (loadingMessage) loadingMessage.textContent = 'Erro ao carregar tarefas.';
            } finally {
                if (loadingMessage) loadingMessage.classList.add('hidden'); 
            }
        }

        function renderTodoItem(todo, prepend = true) { // Adicionado parâmetro prepend
            const listItem = document.createElement('li');
            listItem.className = `task-item ${todo.is_completed ? 'completed' : ''}`;
            listItem.dataset.id = todo.id;

            const taskContentDiv = document.createElement('div');
            taskContentDiv.className = 'task-content';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.id = `task-${todo.id}`;
            checkbox.checked = todo.is_completed;
            checkbox.onchange = () => toggleComplete(todo.id, todo.is_completed); // Evento de mudança no checkbox

            const label = document.createElement('label');
            label.className = 'task-label';
            label.htmlFor = `task-${todo.id}`;
            label.textContent = todo.task;
            // Clicar no label também marca/desmarca
            label.onclick = (e) => { 
                e.preventDefault(); // Evita comportamento duplo se o checkbox já tiver um handler
                checkbox.checked = !checkbox.checked; // Inverte o estado visual
                toggleComplete(todo.id, todo.is_completed); // Chama a função de toggle
            };


            taskContentDiv.appendChild(checkbox);
            taskContentDiv.appendChild(label);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-btn';
            deleteButton.setAttribute('aria-label', 'Remover tarefa');
            deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
            deleteButton.onclick = () => deleteTodo(todo.id);
            
            listItem.appendChild(taskContentDiv);
            listItem.appendChild(deleteButton);

            if (todoList) {
                if (prepend && todoList.firstChild) {
                    todoList.insertBefore(listItem, todoList.firstChild);
                } else {
                    todoList.appendChild(listItem); // Adiciona no final se prepend for false ou lista vazia
                }
            }
        }
        
        async function addSingleTaskToDbAndUi(taskText, fromSuggestion = false) {
            if (!taskText) {
                showMessage('O texto da tarefa não pode estar vazio.', 'error');
                return null;
            }
            if (!supabaseClient || SUPABASE_URL === 'SUA_SUPABASE_URL' || SUPABASE_URL === '') {
                showMessage('Supabase não configurado. Não é possível adicionar tarefa.', 'error');
                return null;
            }

            try {
                const { data, error } = await supabaseClient
                    .from('todos')
                    .insert([{ task: taskText, is_completed: false }])
                    .select() 
                    .single(); 

                if (error) throw error;

                if (data) {
                    renderTodoItem(data, true); // true para prepend (adicionar no topo)
                    if (emptyMessage) emptyMessage.classList.add('hidden');
                    if (!fromSuggestion) { 
                         showMessage('Tarefa adicionada com sucesso!', 'success');
                    }
                    return data; 
                }
            } catch (err) {
                console.error('Erro ao adicionar tarefa:', err);
                showMessage(`Erro ao adicionar tarefa: ${err.message || 'Erro desconhecido'}`, 'error');
                return null;
            }
            return null;
        }

        if (addTodoForm) {
            addTodoForm.addEventListener('submit', async (event) => {
                event.preventDefault(); // Impede o envio padrão do formulário
                const taskText = newTaskInput.value.trim();
                const addedTask = await addSingleTaskToDbAndUi(taskText);
                if (addedTask) { 
                    if (newTaskInput) newTaskInput.value = ''; 
                }
            });
        }

        async function toggleComplete(id, currentDbState) { // currentDbState é o estado ANTES do clique
            if (!supabaseClient || SUPABASE_URL === 'SUA_SUPABASE_URL' || SUPABASE_URL === '') {
                 showMessage('Supabase não configurado. Não é possível atualizar tarefa.', 'error');
                return;
            }
            const newCompletedState = !currentDbState; // O estado que queremos definir no DB

            try {
                const { data, error } = await supabaseClient
                    .from('todos')
                    .update({ is_completed: newCompletedState }) 
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;

                // Atualiza a UI diretamente
                const listItem = todoList.querySelector(`li[data-id='${id}']`);
                if (listItem && data) {
                    listItem.classList.toggle('completed', data.is_completed);
                    const checkbox = listItem.querySelector('.task-checkbox');
                    if (checkbox) {
                        checkbox.checked = data.is_completed;
                    }
                    // Atualiza o estado 'todo.is_completed' no objeto JS se necessário para futuros cliques
                    // Mas como estamos buscando o estado do DB (currentDbState), isso é menos crítico aqui.
                    // Para consistência, poderíamos atualizar o 'todo' objeto se o mantivéssemos em um array JS.
                }
                showMessage('Status da tarefa atualizado!', 'success');
            } catch (err) {
                console.error('Erro ao atualizar tarefa:', err);
                showMessage(`Erro ao atualizar tarefa: ${err.message || 'Erro desconhecido'}`, 'error');
                // Reverter a UI se a atualização do DB falhar
                const listItem = todoList.querySelector(`li[data-id='${id}']`);
                 if (listItem) {
                    listItem.classList.toggle('completed', currentDbState); // Volta ao estado original
                    const checkbox = listItem.querySelector('.task-checkbox');
                    if (checkbox) checkbox.checked = currentDbState;
                }
            }
        }

        async function deleteTodo(id) {
            if (!supabaseClient || SUPABASE_URL === 'SUA_SUPABASE_URL' || SUPABASE_URL === '') {
                showMessage('Supabase não configurado. Não é possível excluir tarefa.', 'error');
                return;
            }
            try {
                const { error } = await supabaseClient
                    .from('todos')
                    .delete()
                    .eq('id', id); 

                if (error) throw error;
                
                const itemToRemove = todoList.querySelector(`li[data-id='${id}']`);
                if (itemToRemove) {
                    itemToRemove.remove();
                }
                if (todoList && todoList.children.length === 0) {
                    if (emptyMessage) emptyMessage.classList.remove('hidden');
                }
                showMessage('Tarefa excluída com sucesso!', 'success');
            } catch (err) {
                console.error('Erro ao excluir tarefa:', err);
                showMessage(`Erro ao excluir tarefa: ${err.message || 'Erro desconhecido'}`, 'error');
            }
        }

        // --- Lógica Gemini API ---
        async function getSubtaskSuggestions(mainTaskText) {
            if (!mainTaskText) {
                showMessage('Digite uma tarefa principal para obter sugestões.', 'error');
                return null;
            }
            setSuggestButtonLoading(true);

            const prompt = `Você é um assistente de planejamento de tarefas. Dada a seguinte tarefa principal, por favor, quebre-a em 3 a 5 subtarefas acionáveis. Retorne apenas a lista de subtarefas, cada uma em uma nova linha. Não inclua marcadores, numeração ou qualquer texto introdutório ou conclusivo. Tarefa Principal: "${mainTaskText}"`;
            const apiKey = ""; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Erro da API Gemini:', errorData);
                    throw new Error(`API Gemini respondeu com status ${response.status}: ${errorData?.error?.message || 'Erro desconhecido'}`);
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const text = result.candidates[0].content.parts[0].text;
                    return text.split('\n')
                               .map(subtask => subtask.replace(/^[\s\-\d\.\*]+/, '').trim()) 
                               .filter(subtask => subtask.length > 0);
                } else {
                    console.warn('Resposta da API Gemini não contém sugestões válidas:', result);
                    showMessage('Não foi possível obter sugestões da IA desta vez.', 'error');
                    return null;
                }
            } catch (error) {
                console.error('Erro ao chamar API Gemini:', error);
                showMessage(`Erro ao obter sugestões: ${error.message}`, 'error');
                return null;
            } finally {
                setSuggestButtonLoading(false);
            }
        }

        if (suggestSubtasksBtn) {
            suggestSubtasksBtn.addEventListener('click', async () => {
                const mainTaskText = newTaskInput.value.trim();
                if (!mainTaskText) {
                    showMessage('Digite uma tarefa principal para obter sugestões.', 'error');
                    return;
                }
                const suggestedSubtasks = await getSubtaskSuggestions(mainTaskText);

                if (suggestedSubtasks && suggestedSubtasks.length > 0) {
                    showMessage(`IA sugeriu ${suggestedSubtasks.length} subtarefas! Adicionando...`, 'success', 2000);
                    
                    // Adiciona as subtarefas. Elas serão adicionadas no topo (prepend).
                    // Para manter a ordem da IA, poderíamos inverter suggestedSubtasks.reverse()
                    // ou chamar fetchTodos() no final para reordenar pelo DB (created_at).
                    // A chamada fetchTodos() abaixo já cuidará da ordenação final.
                    for (const subtask of suggestedSubtasks) {
                        await addSingleTaskToDbAndUi(subtask, true); 
                    }
                    
                    await fetchTodos(); // Recarrega para garantir a ordem correta do DB.

                    if (newTaskInput) newTaskInput.value = ''; 
                } else if (suggestedSubtasks) { 
                     showMessage('A IA não retornou subtarefas para esta ideia.', 'error');
                }
            });
        }

        // --- Inicialização ---
        document.addEventListener('DOMContentLoaded', () => {
            fetchTodos();
        });