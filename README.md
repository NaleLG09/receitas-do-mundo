# Caderno de Receitas do Mundo

Projeto integrador (Atividade 2): aplicação web com **CRUD no Firestore**, **API externa (TheMealDB)** e publicação na **Vercel**.

Tecnologias: HTML, CSS e JavaScript puro (módulos ES), Firebase Firestore (SDK web v10 via CDN) e TheMealDB. Não precisa de `npm install` nem de build.

## O que o sistema faz

| Requisito | Onde está |
|---|---|
| C: cadastrar | Formulário "Cadastrar receita" e botão "Salvar nos favoritos" nos pratos da API |
| R: consultar | Lista "Minhas receitas", atualizada em tempo real, com filtro |
| U: atualizar | Botão "Editar" em cada receita (reaproveita o formulário) |
| D: excluir | Botão "Excluir" em cada receita (pede confirmação) |
| API externa | "Descobrir pratos": países, busca por nome, sorteio e detalhes (ingredientes e preparo) |
| Publicação | Vercel, endereço `.vercel.app` |

## Estrutura

```
receitas-do-mundo/
  index.html          página e estrutura
  style.css           visual
  app.js              lógica: API, CRUD e eventos
  firebase-config.js  chaves do seu projeto Firebase (você preenche)
```

## 1. Abrir no VS Code

1. Abra a pasta `receitas-do-mundo` no VS Code (Arquivo > Abrir Pasta).
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito em `index.html` > **Open with Live Server**.

Os módulos JavaScript não funcionam abrindo o arquivo com duplo clique (`file://`); por isso o Live Server.

## 2. Criar o Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto** (pode desativar o Google Analytics).
2. Na tela inicial do projeto, clique no ícone **Web** (`</>`) para registrar um app. Dê um nome e **não** marque o Firebase Hosting.
3. Copie o objeto `firebaseConfig` mostrado e cole em `firebase-config.js`, no lugar dos `COLE_AQUI`.
4. No menu lateral: **Build > Firestore Database > Criar banco de dados**. Escolha uma região (por exemplo `southamerica-east1`, São Paulo) e inicie em **modo de teste**.

### Regras do Firestore

Em **Firestore Database > Regras**, use algo assim para a atividade e clique em **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /receitas/{id} {
      allow read, write: if true;
    }
  }
}
```

Atenção: essas regras deixam o banco aberto para qualquer pessoa com o link. Serve para a atividade, mas não para um sistema real (aí seria necessário Firebase Authentication).

A coleção `receitas` é criada automaticamente ao salvar a primeira receita. Campos de cada documento: `nome`, `pais`, `categoria`, `imagem`, `ingredientes`, `preparo`, `observacoes`, `idApi` (só nas receitas vindas da API), `criadoEm`, `atualizadoEm`.

## 3. Testar localmente

1. Escolha um país em "Descobrir pratos", clique em um prato e em **Salvar nos favoritos**.
2. Confira a receita em "Minhas receitas" e no console do Firebase (Firestore Database > Dados).
3. Teste **Editar**, **Excluir** e o cadastro manual pelo formulário.

## 4. Publicar na Vercel

### Opção A: pelo GitHub (recomendada)

1. Crie um repositório no GitHub e envie a pasta do projeto (no terminal do VS Code):
   ```
   git init
   git add .
   git commit -m "Projeto integrador"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/receitas-do-mundo.git
   git push -u origin main
   ```
2. Em https://vercel.com, entre com sua conta do GitHub e clique em **Add New > Project**.
3. Importe o repositório. Em **Framework Preset** deixe **Other**; não precisa de Build Command nem Output Directory.
4. Clique em **Deploy**. O endereço final será algo como `https://receitas-do-mundo.vercel.app`.

### Opção B: pela linha de comando

```
npm i -g vercel
vercel login
vercel --prod
```

Responda as perguntas aceitando os padrões (é um site estático).

Observação: o `firebase-config.js` vai junto no repositório. As chaves web do Firebase não são segredos (a proteção real está nas regras do Firestore), então não há problema para a atividade.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Faixa amarela "Firebase ainda não está configurado" | `firebase-config.js` ainda com `COLE_AQUI` |
| "Missing or insufficient permissions" | Regras do Firestore não publicadas ou expiradas |
| Página em branco ao abrir o arquivo | Abriu com duplo clique; use o Live Server |
| Lista de países vazia | Sem internet ou bloqueio da API; recarregue |
