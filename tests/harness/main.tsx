import { createRoot } from 'react-dom/client';
import { Dashboard } from '../../src/ui/Dashboard';
import { PortalContext } from '../../src/ui/PortalContext';
import theme from '../../src/ui/theme.css';
import { FixtureController } from './FixtureController';
const host=document.querySelector('#app')!,shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=theme;shadow.append(style);const mount=document.createElement('div');mount.className='cosmos-mount';shadow.append(mount);const portal=document.createElement('div');portal.className='cosmos-portal dark';shadow.append(portal);const controller=new FixtureController();(window as any).fixture=controller;createRoot(mount).render(<PortalContext.Provider value={portal}><Dashboard controller={controller} spiderURL="/spider.glb" openFile={path=>{(window as any).lastOpened=path;}}/></PortalContext.Provider>);
