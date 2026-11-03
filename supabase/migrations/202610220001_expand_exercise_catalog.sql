begin;

alter table public.exercise_catalog
  drop constraint exercise_catalog_muscle_group_check;

update public.exercise_catalog
set muscle_group = case id
  when 'squat' then 'Quadriceps'
  when 'goblet-squat' then 'Quadriceps'
  when 'leg-press' then 'Quadriceps'
  when 'leg-extension' then 'Quadriceps'
  when 'lunge' then 'Quadriceps'
  when 'leg-curl' then 'Posterior de coxa'
  when 'seated-leg-curl' then 'Posterior de coxa'
  when 'romanian-deadlift' then 'Posterior de coxa'
  when 'calf-raise' then 'Panturrilhas'
  when 'hip-abduction' then 'Abdutores'
  else muscle_group
end;

alter table public.exercise_catalog
  add constraint exercise_catalog_muscle_group_check check (muscle_group in (
    'Peito', 'Costas', 'Ombros', 'Biceps', 'Triceps', 'Trapezio', 'Antebracos',
    'Quadriceps', 'Posterior de coxa', 'Gluteos', 'Adutores', 'Abdutores',
    'Panturrilhas', 'Abdomen', 'Cardio'
  ));

insert into public.exercise_catalog(id, name, muscle_group, equipment, kind) values
  ('decline-bench', 'Supino declinado com barra', 'Peito', 'Barra e banco declinado', 'strength'),
  ('smith-bench', 'Supino no Smith', 'Peito', 'Smith e banco', 'strength'),
  ('incline-dumbbell-fly', 'Crucifixo inclinado com halteres', 'Peito', 'Halteres e banco inclinado', 'strength'),
  ('pec-deck', 'Crucifixo na máquina', 'Peito', 'Máquina', 'strength'),
  ('low-cable-fly', 'Crossover de baixo para cima', 'Peito', 'Polia', 'strength'),
  ('chest-dip', 'Mergulho nas paralelas', 'Peito', 'Barras paralelas', 'strength'),
  ('wide-lat-pulldown', 'Puxada alta com pegada aberta', 'Costas', 'Polia e barra longa', 'strength'),
  ('neutral-lat-pulldown', 'Puxada alta com pegada neutra', 'Costas', 'Polia e pegador neutro', 'strength'),
  ('chest-supported-row', 'Remada com peito apoiado', 'Costas', 'Halteres e banco inclinado', 'strength'),
  ('t-bar-row', 'Remada cavalinho', 'Costas', 'Barra T ou landmine', 'strength'),
  ('single-arm-cable-row', 'Remada unilateral na polia', 'Costas', 'Polia', 'strength'),
  ('straight-arm-pulldown', 'Pulldown com braços estendidos', 'Costas', 'Polia e barra', 'strength'),
  ('arnold-press', 'Desenvolvimento Arnold', 'Ombros', 'Halteres', 'strength'),
  ('machine-shoulder-press', 'Desenvolvimento na máquina', 'Ombros', 'Máquina', 'strength'),
  ('cable-lateral-raise', 'Elevação lateral na polia', 'Ombros', 'Polia', 'strength'),
  ('reverse-pec-deck', 'Crucifixo inverso na máquina', 'Ombros', 'Máquina', 'strength'),
  ('incline-curl', 'Rosca inclinada com halteres', 'Biceps', 'Halteres e banco inclinado', 'strength'),
  ('concentration-curl', 'Rosca concentrada', 'Biceps', 'Halter', 'strength'),
  ('bayesian-curl', 'Rosca unilateral atrás do corpo', 'Biceps', 'Polia', 'strength'),
  ('close-grip-bench', 'Supino fechado', 'Triceps', 'Barra e banco', 'strength'),
  ('overhead-rope-extension', 'Extensão de tríceps acima da cabeça', 'Triceps', 'Polia e corda', 'strength'),
  ('single-arm-triceps-extension', 'Extensão unilateral de tríceps', 'Triceps', 'Polia', 'strength'),
  ('dumbbell-shrug', 'Encolhimento com halteres', 'Trapezio', 'Halteres', 'strength'),
  ('barbell-shrug', 'Encolhimento com barra', 'Trapezio', 'Barra', 'strength'),
  ('cable-shrug', 'Encolhimento na polia', 'Trapezio', 'Polia', 'strength'),
  ('wrist-curl', 'Flexão de punhos', 'Antebracos', 'Barra ou halteres', 'strength'),
  ('reverse-wrist-curl', 'Extensão de punhos', 'Antebracos', 'Barra ou halteres', 'strength'),
  ('front-squat', 'Agachamento frontal', 'Quadriceps', 'Barra', 'strength'),
  ('hack-squat', 'Agachamento no hack', 'Quadriceps', 'Máquina hack', 'strength'),
  ('bulgarian-split-squat', 'Agachamento búlgaro', 'Quadriceps', 'Halteres ou barra', 'strength'),
  ('step-up', 'Subida no banco', 'Quadriceps', 'Banco e halteres opcionais', 'strength'),
  ('single-leg-press', 'Leg press unilateral', 'Quadriceps', 'Máquina leg press', 'strength'),
  ('smith-squat', 'Agachamento no Smith', 'Quadriceps', 'Smith', 'strength'),
  ('stiff-dumbbell', 'Levantamento stiff com halteres', 'Posterior de coxa', 'Halteres', 'strength'),
  ('nordic-curl', 'Flexão nórdica de joelhos', 'Posterior de coxa', 'Apoio para os tornozelos', 'strength'),
  ('lying-leg-curl', 'Mesa flexora deitada', 'Posterior de coxa', 'Máquina', 'strength'),
  ('good-morning', 'Good morning', 'Posterior de coxa', 'Barra', 'strength'),
  ('back-extension', 'Extensão de quadril no banco', 'Posterior de coxa', 'Banco romano', 'strength'),
  ('cable-pull-through', 'Pull-through na polia', 'Gluteos', 'Polia e corda', 'strength'),
  ('machine-glute-kickback', 'Coice de glúteo na máquina', 'Gluteos', 'Máquina', 'strength'),
  ('single-leg-hip-thrust', 'Elevação pélvica unilateral', 'Gluteos', 'Banco e peso opcional', 'strength'),
  ('weighted-glute-bridge', 'Ponte de glúteos com carga', 'Gluteos', 'Halter ou barra', 'strength'),
  ('frog-pump', 'Frog pump', 'Gluteos', 'Peso corporal ou carga', 'strength'),
  ('hip-adduction-machine', 'Cadeira adutora', 'Adutores', 'Máquina', 'strength'),
  ('cable-hip-adduction', 'Adução de quadril na polia', 'Adutores', 'Polia e tornozeleira', 'strength'),
  ('standing-cable-abduction', 'Abdução de quadril na polia', 'Abdutores', 'Polia e tornozeleira', 'strength'),
  ('band-lateral-walk', 'Caminhada lateral com miniband', 'Abdutores', 'Miniband', 'strength'),
  ('standing-calf-raise', 'Panturrilha em pé', 'Panturrilhas', 'Máquina ou degrau', 'strength'),
  ('seated-calf-raise', 'Panturrilha sentada', 'Panturrilhas', 'Máquina', 'strength'),
  ('donkey-calf-raise', 'Panturrilha no donkey', 'Panturrilhas', 'Máquina ou apoio', 'strength'),
  ('plank', 'Prancha frontal', 'Abdomen', 'Colchonete', 'strength'),
  ('side-plank', 'Prancha lateral', 'Abdomen', 'Colchonete', 'strength'),
  ('pallof-press', 'Pallof press', 'Abdomen', 'Polia ou faixa elástica', 'strength'),
  ('russian-twist', 'Rotação russa', 'Abdomen', 'Colchonete e carga opcional', 'strength'),
  ('hanging-leg-raise', 'Elevação de joelhos suspenso', 'Abdomen', 'Barra fixa', 'strength'),
  ('ab-wheel', 'Abdominal com roda', 'Abdomen', 'Roda abdominal', 'strength'),
  ('bicycle-crunch', 'Abdominal bicicleta', 'Abdomen', 'Colchonete', 'strength'),
  ('cable-woodchop', 'Rotação de tronco na polia', 'Abdomen', 'Polia', 'strength'),
  ('air-bike', 'Bicicleta de braços e pernas', 'Cardio', 'Air bike', 'cardio'),
  ('ski-erg', 'Ski ergométrico', 'Cardio', 'Ski erg', 'cardio'),
  ('stair-walking', 'Subida de escadas', 'Cardio', 'Escadas', 'cardio'),
  ('swimming', 'Natação', 'Cardio', 'Piscina', 'cardio'),
  ('outdoor-cycling', 'Ciclismo ao ar livre', 'Cardio', 'Bicicleta', 'cardio'),
  ('hiking', 'Caminhada em trilha', 'Cardio', 'Sem equipamento', 'cardio')
on conflict (id) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  kind = excluded.kind;

commit;
