<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Srun Sochettra - Developer Profile</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #06b6d4;
            --secondary: #8b5cf6;
            --accent: #f472b6;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            overflow-x: hidden;
        }
        
        h1, h2, h3, .font-display {
            font-family: 'Space Grotesk', sans-serif;
        }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #1c1917;
        }
        ::-webkit-scrollbar-thumb {
            background: #0891b2;
            border-radius: 4px;
        }
        
        /* Glitch Effect */
        .glitch {
            position: relative;
            animation: glitch-skew 1s infinite linear alternate-reverse;
        }
        .glitch::before,
        .glitch::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .glitch::before {
            left: 2px;
            text-shadow: -2px 0 #ff00c1;
            clip: rect(44px, 450px, 56px, 0);
            animation: glitch-anim 5s infinite linear alternate-reverse;
        }
        .glitch::after {
            left: -2px;
            text-shadow: -2px 0 #00fff9, 2px 2px #ff00c1;
            animation: glitch-anim2 1s infinite linear alternate-reverse;
        }
        
        @keyframes glitch-anim {
            0% { clip: rect(30px, 9999px, 10px, 0); }
            20% { clip: rect(80px, 9999px, 90px, 0); }
            40% { clip: rect(10px, 9999px, 50px, 0); }
            60% { clip: rect(60px, 9999px, 20px, 0); }
            80% { clip: rect(20px, 9999px, 70px, 0); }
            100% { clip: rect(90px, 9999px, 30px, 0); }
        }
        @keyframes glitch-anim2 {
            0% { clip: rect(10px, 9999px, 80px, 0); }
            20% { clip: rect(70px, 9999px, 20px, 0); }
            40% { clip: rect(30px, 9999px, 60px, 0); }
            60% { clip: rect(90px, 9999px, 10px, 0); }
            80% { clip: rect(50px, 9999px, 40px, 0); }
            100% { clip: rect(20px, 9999px, 90px, 0); }
        }
        @keyframes glitch-skew {
            0% { transform: skew(0deg); }
            10% { transform: skew(-2deg); }
            20% { transform: skew(2deg); }
            30% { transform: skew(0deg); }
            100% { transform: skew(0deg); }
        }
        
        /* Floating Animation */
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        .float-anim {
            animation: float 6s ease-in-out infinite;
        }
        
        /* Gradient Text */
        .gradient-text {
            background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #f472b6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* Card Hover Effects */
        .skill-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .skill-card:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 20px 40px -15px rgba(6, 182, 212, 0.3);
        }
        
        /* Glassmorphism */
        .glass {
            background: rgba(28, 25, 23, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        /* Typing Cursor */
        .typing-cursor::after {
            content: '|';
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        
        /* Particle Canvas */
        #canvas-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
        }
        
        /* Skill Icon Bounce */
        @keyframes icon-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .icon-bounce:hover {
            animation: icon-bounce 0.6s ease infinite;
        }
        
        /* Connection Lines */
        .connection-line {
            position: absolute;
            background: linear-gradient(90deg, transparent, #0891b2, transparent);
            height: 1px;
            opacity: 0.3;
        }
    </style>
</head>
<body class="antialiased">

    <!-- Three.js Background -->
    <div id="canvas-container"></div>

    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex-shrink-0 flex items-center">
                    <span class="font-display font-bold text-xl gradient-text">&lt;SS/&gt;</span>
                </div>
                <div class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-8">
                        <a href="#about" class="hover:text-cyan-400 transition-colors duration-300 text-sm font-medium">About</a>
                        <a href="#skills" class="hover:text-cyan-400 transition-colors duration-300 text-sm font-medium">Skills</a>
                        <a href="#connect" class="hover:text-cyan-400 transition-colors duration-300 text-sm font-medium">Connect</a>
                        <a href="#stats" class="hover:text-cyan-400 transition-colors duration-300 text-sm font-medium">Stats</a>
                    </div>
                </div>
                <div class="md:hidden">
                    <button id="mobile-menu-btn" class="text-gray-300 hover:text-white">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
        <!-- Mobile Menu -->
        <div id="mobile-menu" class="hidden md:hidden glass border-t border-white/10">
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <a href="#about" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10">About</a>
                <a href="#skills" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10">Skills</a>
                <a href="#connect" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10">Connect</a>
                <a href="#stats" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10">Stats</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-cyan-900/20 via-transparent to-transparent"></div>
        
        <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div class="mb-8 inline-block">
                <img src="https://user-images.githubusercontent.com/18350557/176309783-0785949b-9127-417c-8b55-ab5a4333674e.gif" 
                     alt="Wave" 
                     class="w-24 h-24 mx-auto float-anim rounded-full border-2 border-cyan-400/30 p-2">
            </div>
            
            <h1 class="text-5xl md:text-7xl font-bold mb-4 font-display">
                Hi, I'm <span class="glitch gradient-text" data-text="Srun Sochettra">Srun Sochettra</span>
            </h1>
            
            <div class="h-8 mb-6">
                <span id="typing-text" class="text-xl md:text-2xl text-gray-400 typing-cursor font-light"></span>
            </div>
            
            <div class="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
                <span class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Phnom Penh, Cambodia
                </span>
                <span class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <span class="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                    Second Year IT Student
                </span>
                <span class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <span class="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                    Full Stack Learner
                </span>
            </div>

            <div class="mt-12">
                <a href="#about" class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors animate-bounce">
                    <span>Explore</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                    </svg>
                </a>
            </div>
        </div>
    </section>

    <!-- About Section -->
    <section id="about" class="py-24 relative">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="glass rounded-3xl p-8 md:p-12 border border-white/10 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div class="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
                
                <div class="relative z-10">
                    <h2 class="text-3xl md:text-4xl font-bold mb-8 font-display gradient-text">About Me</h2>
                    
                    <div class="prose prose-invert prose-lg max-w-none">
                        <p class="text-gray-300 leading-relaxed text-lg mb-6">
                            I am a second-year IT student currently debugging my way through Java. While I spend most of my time trying to fix code, I also possess a rare hardware feature: I have hypermobile fingers. It's a completely vestigial skill that serves no purpose in a professional setting, but it remains my most impressive biological party trick.
                        </p>
                        
                        <div class="grid md:grid-cols-2 gap-6 mt-8">
                            <div class="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-cyan-500/30 transition-colors group">
                                <div class="flex items-start gap-4">
                                    <div class="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold text-white mb-1">Contact</h3>
                                        <a href="mailto:srunsochettra@gmail.com" class="text-cyan-400 hover:text-cyan-300 transition-colors">srunsochettra@gmail.com</a>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-purple-500/30 transition-colors group">
                                <div class="flex items-start gap-4">
                                    <div class="p-3 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold text-white mb-1">Collaboration</h3>
                                        <p class="text-gray-400 text-sm">Open to learning and meeting new people!</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-pink-500/30 transition-colors group">
                                <div class="flex items-start gap-4">
                                    <div class="p-3 rounded-lg bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold text-white mb-1">Learning</h3>
                                        <p class="text-gray-400 text-sm">Full Stack Web Development</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-yellow-500/30 transition-colors group">
                                <div class="flex items-start gap-4">
                                    <div class="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 group-hover:scale-110 transition-transform">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold text-white mb-1">Fun Fact</h3>
                                        <p class="text-gray-400 text-sm">I can move my ears (auricular superior muscle control)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Skills Section -->
    <section id="skills" class="py-24 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-5xl font-bold mb-4 font-display gradient-text">Technical Arsenal</h2>
                <p class="text-gray-400 max-w-2xl mx-auto">Technologies and tools I work with</p>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6" id="skills-grid">
                <!-- Skills will be populated by JS -->
            </div>
        </div>
    </section>

    <!-- Socials Section -->
    <section id="connect" class="py-24 relative bg-gradient-to-b from-transparent via-cyan-900/10 to-transparent">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 class="text-3xl md:text-4xl font-bold mb-12 font-display gradient-text">Let's Connect</h2>
            
            <div class="flex flex-wrap justify-center gap-6 mb-12">
                <a href="https://www.github.com/SRUN-Sochettra" target="_blank" rel="noreferrer" 
                   class="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-gray-400/50 transition-all duration-300 hover:-translate-y-2">
                    <div class="absolute inset-0 bg-gradient-to-r from-gray-600/20 to-gray-400/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img src="https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/socials/github.svg" 
                         alt="GitHub" class="w-12 h-12 relative z-10 invert group-hover:scale-110 transition-transform">
                    <span class="block mt-2 text-sm text-gray-400 group-hover:text-white transition-colors">GitHub</span>
                </a>
                
                <a href="https://www.linkedin.com/in/sochettra-srun-a67466395/" target="_blank" rel="noreferrer" 
                   class="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-400/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img src="https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/socials/linkedin.svg" 
                         alt="LinkedIn" class="w-12 h-12 relative z-10 group-hover:scale-110 transition-transform">
                    <span class="block mt-2 text-sm text-gray-400 group-hover:text-white transition-colors">LinkedIn</span>
                </a>
                
                <a href="https://www.facebook.com/srunsochettra" target="_blank" rel="noreferrer" 
                   class="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-600/50 transition-all duration-300 hover:-translate-y-2">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-800/20 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img src="https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/socials/facebook.svg" 
                         alt="Facebook" class="w-12 h-12 relative z-10 group-hover:scale-110 transition-transform">
                    <span class="block mt-2 text-sm text-gray-400 group-hover:text-white transition-colors">Facebook</span>
                </a>
            </div>

            <div class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
                <img src="https://img.shields.io/github/followers/SRUN-Sochettra?logo=github&style=for-the-badge&color=0891b2&labelColor=1c1917" 
                     alt="GitHub Followers" class="h-8 rounded-full">
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section id="stats" class="py-24 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl md:text-4xl font-bold mb-12 text-center font-display gradient-text">GitHub Analytics</h2>
            
            <div class="grid md:grid-cols-2 gap-8 mb-12">
                <div class="glass rounded-2xl p-6 border border-white/10 hover:border-cyan-500/30 transition-all duration-500 group">
                    <div class="relative overflow-hidden rounded-xl">
                        <img src="https://github-readme-stats.vercel.app/api?username=SRUN-Sochettra&show_icons=true&hide=&count_private=true&title_color=0891b2&text_color=ffffff&icon_color=0891b2&bg_color=1c1917&hide_border=true&show_icons=true" 
                             alt="GitHub Stats" 
                             class="w-full transform group-hover:scale-105 transition-transform duration-500">
                    </div>
                </div>
                
                <div class="glass rounded-2xl p-6 border border-white/10 hover:border-cyan-500/30 transition-all duration-500 group">
                    <div class="relative overflow-hidden rounded-xl">
                        <img src="https://github-readme-streak-stats.herokuapp.com/?user=SRUN-Sochettra&stroke=ffffff&background=1c1917&ring=0891b2&fire=0891b2&currStreakNum=ffffff&currStreakLabel=0891b2&sideNums=ffffff&sideLabels=ffffff&dates=ffffff&hide_border=true" 
                             alt="GitHub Streak" 
                             class="w-full transform group-hover:scale-105 transition-transform duration-500">
                    </div>
                </div>
            </div>
            
            <div class="glass rounded-2xl p-6 border border-white/10 mb-12">
                <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=SRUN-Sochettra&langs_count=10&title_color=0891b2&text_color=ffffff&icon_color=0891b2&bg_color=1c1917&hide_border=true&locale=en&custom_title=Top%20Languages" 
                     alt="Top Languages" 
                     class="w-full md:w-2/3 mx-auto rounded-xl">
            </div>

            <div class="text-center">
                <h3 class="text-2xl font-bold mb-8 font-display text-white">Top Repository</h3>
                <a href="https://github.com/SRUN-Sochettra/University" target="_blank" rel="noreferrer" 
                   class="inline-block transform hover:scale-105 transition-transform duration-300">
                    <img src="https://github-readme-stats.vercel.app/api/pin/?username=SRUN-Sochettra&repo=University&title_color=0891b2&text_color=ffffff&icon_color=0891b2&bg_color=1c1917&hide_border=true&locale=en" 
                         alt="University Repo" 
                         class="rounded-xl shadow-2xl shadow-cyan-500/20">
                </a>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 border-t border-white/10 bg-black/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p class="text-gray-500 text-sm">
                © 2026 Srun Sochettra. Crafted with code, caffeine, and hypermobile fingers.
            </p>
        </div>
    </footer>

    <script>
        // Skills Data
        const skills = [
            { name: 'Spring Boot', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/spring-boot-colored.svg', color: 'from-green-500/20 to-green-400/20' },
            { name: 'Git', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/git-colored.svg', color: 'from-orange-500/20 to-orange-400/20' },
            { name: 'Java', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/java-colored.svg', color: 'from-red-500/20 to-red-400/20' },
            { name: 'JavaScript', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/javascript-colored.svg', color: 'from-yellow-500/20 to-yellow-400/20' },
            { name: 'PHP', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/php-colored.svg', color: 'from-indigo-500/20 to-indigo-400/20' },
            { name: 'Python', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/python-colored.svg', color: 'from-blue-500/20 to-yellow-400/20' },
            { name: 'Bash', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/gnubash-colored.svg', color: 'from-gray-500/20 to-gray-400/20' },
            { name: 'VS Code', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/visualstudiocode-colored.svg', color: 'from-blue-600/20 to-blue-400/20' },
            { name: 'HTML5', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/html5-colored.svg', color: 'from-orange-600/20 to-orange-400/20' },
            { name: 'CSS3', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/css3-colored.svg', color: 'from-blue-500/20 to-blue-300/20' },
            { name: 'Tailwind', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/tailwindcss-colored.svg', color: 'from-cyan-500/20 to-cyan-400/20' },
            { name: 'MySQL', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/mysql-colored.svg', color: 'from-blue-700/20 to-blue-500/20' },
            { name: 'PostgreSQL', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/postgresql-colored.svg', color: 'from-blue-800/20 to-blue-600/20' },
            { name: 'Figma', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/figma-colored.svg', color: 'from-purple-500/20 to-pink-400/20' },
            { name: 'Arduino', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/arduino-colored.svg', color: 'from-teal-500/20 to-teal-400/20' },
            { name: 'Raspberry Pi', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/raspberrypi-colored.svg', color: 'from-red-600/20 to-red-400/20' },
            { name: 'Flutter', icon: 'https://raw.githubusercontent.com/danielcranney/readme-generator/main/public/icons/skills/flutter-colored.svg', color: 'from-cyan-400/20 to-blue-400/20' }
        ];

        // Render Skills
        const skillsGrid = document.getElementById('skills-grid');
        skills.forEach((skill, index) => {
            const card = document.createElement('div');
            card.className = `skill-card group relative p-6 rounded-2xl bg-gradient-to-br ${skill.color} border border-white/10 cursor-pointer`;
            card.style.animationDelay = `${index * 50}ms`;
            card.innerHTML = `
                <div class="flex flex-col items-center gap-3">
                    <div class="relative w-12 h-12 icon-bounce">
                        <img src="${skill.icon}" alt="${skill.name}" class="w-full h-full object-contain drop-shadow-lg">
                    </div>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors text-center">${skill.name}</span>
                </div>
                <div class="absolute inset-0 rounded-2xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            `;
            skillsGrid.appendChild(card);
        });

        // Typing Effect
        const texts = ['A second year IT student!', 'Debugging my way through Java', 'Full Stack Web Learner', 'Hypermobile fingers included'];
        let textIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        const typingElement = document.getElementById('typing-text');

        function type() {
            const currentText = texts[textIndex];
            
            if (isDeleting) {
                typingElement.textContent = currentText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                typingElement.textContent = currentText.substring(0, charIndex + 1);
                charIndex++;
            }

            let typeSpeed = isDeleting ? 50 : 100;

            if (!isDeleting && charIndex === currentText.length) {
                typeSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        }

        // Start typing
        type();

        // Mobile Menu Toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Three.js Background
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        // Create particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 1500;
        const posArray = new Float32Array(particlesCount * 3);
        const colorArray = new Float32Array(particlesCount * 3);

        for(let i = 0; i < particlesCount * 3; i += 3) {
            // Position
            posArray[i] = (Math.random() - 0.5) * 50;
            posArray[i+1] = (Math.random() - 0.5) * 50;
            posArray[i+2] = (Math.random() - 0.5) * 50;
            
            // Colors (cyan to purple gradient)
            const mixed = Math.random();
            colorArray[i] = 0.02 + mixed * 0.5;     // R
            colorArray[i+1] = 0.7 + mixed * 0.1;    // G
            colorArray[i+2] = 0.8 + mixed * 0.2;    // B
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);

        camera.position.z = 30;

        // Mouse interaction
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX) / 100;
            mouseY = (event.clientY - windowHalfY) / 100;
        });

        // Animation loop
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            
            const elapsedTime = clock.getElapsedTime();

            targetX = mouseX * 0.5;
            targetY = mouseY * 0.5;

            particlesMesh.rotation.y += 0.001;
            particlesMesh.rotation.x += 0.0005;
            
            // Smooth camera movement
            particlesMesh.rotation.y += 0.05 * (targetX - particlesMesh.rotation.y);
            particlesMesh.rotation.x += 0.05 * (targetY - particlesMesh.rotation.x);

            // Wave effect
            const positions = particlesGeometry.attributes.position.array;
            for(let i = 0; i < particlesCount; i++) {
                const i3 = i * 3;
                positions[i3 + 1] += Math.sin(elapsedTime + positions[i3]) * 0.01;
            }
            particlesGeometry.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
        }

        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe elements
        document.querySelectorAll('.skill-card').forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = `all 0.6s ease ${i * 0.05}s`;
            observer.observe(el);
        });
    </script>
</body>
</html>
