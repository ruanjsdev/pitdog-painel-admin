# Build e versao

## Requisito

Use Node.js 20.19 ou mais novo. O Vite deste projeto nao roda build completo no Node 18.

## Rodar em desenvolvimento

```bash
npm run electron:dev
```

## Gerar executavel Linux

```bash
npm run dist:linux
```

Saida:

```text
release/Pits Dog Admin-VERSAO-linux-ARCH.AppImage
release/Pits Dog Admin-VERSAO-linux-ARCH.deb
```

## Gerar executavel Windows

```bash
npm run dist:win
```

Saida:

```text
release/Pits Dog Admin-VERSAO-win-ARCH.exe
```

No Linux, o build Windows pode pedir Wine/Mono. Se falhar por isso, instale:

```bash
sudo apt install wine mono-complete
```

## Gerar Linux e Windows juntos

```bash
npm run dist:all
```

## Lancar uma nova versao

Para correcao pequena:

```bash
npm run version:patch
npm run dist:linux
```

Para mudanca maior de funcionalidade:

```bash
npm run version:minor
npm run dist:linux
```

O numero em `package.json` entra no nome do instalador gerado em `release/`.
