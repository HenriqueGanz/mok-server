# 🚀 Guia Rápido - Iniciar Servidor MoK Online

## ✅ Pré-requisitos

Tudo já está configurado! ✨

## 🏃 Como Iniciar

### 1. Terminal 1 - Servidor

```bash
cd /workspaces/mok-server
npm run dev
```

Você deverá ver:
```
🚀 HTTP + Colyseus server rodando na porta 2567
✅ Prisma conectado ao banco de dados
🎮 MainMapRoom criada - Sistema Completo
📦 Carregados 9 templates de mobs
🐛 Total de 52 mobs spawnados no mapa
```

---

## 🎮 Como Testar

### 1. Fazer Login

Use as credenciais de teste:
- **Email**: `henrique@example.com`
- **Senha**: `123456`

### 2. Criar um Personagem (Opcional)

```bash
# Obter token (faça login primeiro)
TOKEN="seu-token-aqui"

# Criar um novo personagem
curl -X POST http://localhost:2567/characters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GuerreiroBravo",
    "class": "warrior"
  }'
```

### 3. Listar Personagens

```bash
curl http://localhost:2567/characters \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Selecionar Personagem

```bash
# Substitua :id pelo ID do seu personagem
curl -X POST http://localhost:2567/characters/1/select \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Conectar ao Jogo

Agora você pode conectar usando o cliente:
- O personagem selecionado será carregado automaticamente
- Você spawna no centro da floresta (0, 0)
- Todos os seus stats e inventário são carregados

---

## 🗺️ O Que Você Pode Fazer

### Explorar o Mundo

Visite todas as 9 zonas:
- **Floresta** (centro) - Slimes (Lv. 1)
- **Deserto** (direita) - Desert Slimes (Lv. 2)
- **Pântano** (cima) - Swamp Slimes (Lv. 3)
- **Neve** (esquerda) - Ice Slimes (Lv. 4)
- **Vulcão** (baixo) - Fire Slimes (Lv. 5)
- **Montanhas** (cima-direita) - Rock Golems (Lv. 5)
- **Tundra** (cima-esquerda) - Frost Wolves (Lv. 4)
- **Caverna** (baixo-esquerda) - Shadow Bats (Lv. 5)
- **Praia** (baixo-direita) - Crabs (Lv. 3)

### Combater Mobs

- Ataque mobs para ganhar XP
- Mobs vão atacar de volta!
- Cuidado com a sua vida
- Mobs podem dropar itens

### Progredir

- Ganhe XP matando mobs
- Suba de nível automaticamente
- Seus stats aumentam a cada level
- Seu HP é totalmente restaurado ao subir de nível

### Coletar Loot

- Mobs têm chance de dropar itens
- Itens vão para seu inventário automaticamente
- Você pode equipar itens para bônus de stats

---

## 📊 Classes Disponíveis

### 🛡️ Warrior (Guerreiro)
- **HP**: 150 | **Ataque**: 15 | **Defesa**: 10
- **Alcance**: 60 | **Velocidade**: 180
- **Estilo**: Tanque com alta defesa

### 🔮 Mage (Mago)
- **HP**: 80 | **Ataque**: 25 | **Defesa**: 3
- **Alcance**: 120 | **Velocidade**: 200
- **Estilo**: Dano mágico de longo alcance

### 🗡️ Rogue (Ladino)
- **HP**: 100 | **Ataque**: 20 | **Defesa**: 5
- **Alcance**: 50 | **Velocidade**: 250
- **Estilo**: Rápido e ágil

### 🏹 Archer (Arqueiro)
- **HP**: 90 | **Ataque**: 22 | **Defesa**: 4
- **Alcance**: 150 | **Velocidade**: 220
- **Estilo**: Dano físico de longo alcance

---

## 🔍 Monitorar Logs

O servidor mostra logs úteis:

```
✅ Personagem criado: GuerreiroBravo (warrior)
🎮 Personagem selecionado: GuerreiroBravo
👤 henrique@example.com (GuerreiroBravo - warrior) entrou no jogo
⚔️ henrique@example.com atacou Slime da Floresta por 13 de dano
💀 Slime da Floresta morreu!
⭐ henrique@example.com alcançou level 2!
💎 henrique@example.com recebeu Amulet of Hope!
🔥 Lobo Gélido atacou henrique@example.com por 8 de dano
💀 henrique@example.com morreu!
⚰️ henrique@example.com respawnou, perdeu 10 XP
```

---

## ❓ Troubleshooting

### Erro: "Nenhum personagem selecionado"

Você precisa selecionar um personagem antes de entrar no jogo:

```bash
curl -X POST http://localhost:2567/characters/1/select \
  -H "Authorization: Bearer $TOKEN"
```

### Erro: "Token inválido"

Faça login novamente para obter um novo token:

```bash
curl -X POST http://localhost:2567/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "henrique@example.com",
    "password": "123456"
  }'
```

### Banco de dados vazio?

Execute o seed novamente:

```bash
npx prisma db seed
```

---

## 📝 Usuário de Teste

Já existe um usuário no banco:

- **Email**: `henrique@example.com`
- **Senha**: `123456`
- **Personagem**: Henro (Warrior, Level 1)

---

## 🎯 Próximos Passos

1. ✅ Servidor iniciado
2. ✅ Login feito
3. ✅ Personagem selecionado
4. 🎮 **Conecte o cliente e jogue!**

---

**Dica**: Deixe o terminal do servidor aberto para ver todos os eventos do jogo em tempo real!

**Divirta-se! 🎉**
