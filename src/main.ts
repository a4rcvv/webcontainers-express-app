import { FileNode, WebContainer } from '@webcontainer/api';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { files } from './files';
import './style.css';

let webcontainerInstance: WebContainer




document.querySelector('#app').innerHTML = `
  <div class="container">
    <div class="editor">
      <textarea>I am a textarea</textarea>
    </div>
    <div class="preview">
      <iframe src="loading.html"></iframe>
    </div>
  </div>
  <div class="terminal"></div>
`;

const iframeEl: HTMLIFrameElement | null = document.querySelector('iframe');
const textareaEl: HTMLTextAreaElement | null = document.querySelector('textarea');
const terminalEl: HTMLDivElement | null = document.querySelector('.terminal');

const installDependencies = async(terminal: Terminal) =>{
  const process = await webcontainerInstance.spawn('npm', ['install']);
  process.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data)
    }
  }));
  return process.exit
}

const startDevServer = async(terminal: Terminal) =>{
  const process = await webcontainerInstance.spawn('npm', ['start']);
  process.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data)
    }
  }));
  webcontainerInstance.on("server-ready", (port, url)=>{
    iframeEl.src = url
  })
  return process.exit
}

const writeIndexJs = async (contents: string) => {
  await webcontainerInstance.fs.writeFile('index.js', contents);
}

const startShell = async(terminal: Terminal)=> {
  const shellProcess = await webcontainerInstance.spawn('jsh', {
    terminal: {
      columns: terminal.cols,
      rows: terminal.rows,
    }
  });
  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );
  const input = shellProcess.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });
  return shellProcess;
};

window.addEventListener('load', async () => {
  const fitAddon = new FitAddon();
  const terminal = new Terminal({
    convertEol: true,
  })
  terminal.loadAddon(fitAddon)
  terminal.open(terminalEl)
  fitAddon.fit()
  // Call only once
  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);
  // const exitCode = await installDependencies(terminal)
  // if(exitCode !== 0){
  //   throw new Error('Failed to install dependencies')
  // }

  // startDevServer(terminal)
  // const packageJson = await webcontainerInstance.fs.readFile('package.json', 'utf-8');
  // console.log(packageJson);
  const indexJs: FileNode = files["index.js"]
  textareaEl.value = indexJs.file.contents
  textareaEl.addEventListener('input', async (e) => {
    await writeIndexJs(textareaEl.value)
  });
  webcontainerInstance.on("server-ready", (port, url)=>{
    iframeEl.src = url
  })
  const shellProcess = await startShell(terminal)
  window.addEventListener('resize', ()=>{
    fitAddon.fit()
    shellProcess.resize({
      cols: terminal.cols,
      rows: terminal.rows
    })
  })
});