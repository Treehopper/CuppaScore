import { mount } from 'svelte';
import App from './App.svelte';
import { install } from './lib/install.svelte';
import { pwa } from './lib/pwa.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');

pwa.register();
install.init();

export default mount(App, { target });
