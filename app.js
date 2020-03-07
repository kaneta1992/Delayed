window.onload = function () {
    let canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
    document.body.appendChild(canvas);
    
    gl = canvas.getContext("webgl2") || canvas.getContext("experimental-webgl2");

    vertex = `
    #version 300 es
    void main()
    { 
        gl_Position = vec4(ivec2(gl_VertexID&1,gl_VertexID>>1)*2-1,0,1);
    }
    `

    vertexShader = new Shader(vertex, gl.VERTEX_SHADER);
    fragmentShader = new Shader(fs.text, gl.FRAGMENT_SHADER);
    program = new ShaderProgram();

    program.Link(vertexShader, fragmentShader);
    program.Use();
    program.Send2f("resolution", canvas.width, canvas.height);
    
    let zero = Date.now();
    (function () { 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        program.Send1f("time", (Date.now() - zero) * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(arguments.callee);
    })();
};