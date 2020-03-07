function CompileShader(src, type) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, src.replace(/^\n/, ""));
    gl.compileShader(shader);
    return shader;
}

class Shader {
    constructor(src, type) {
        this.shader = 0;
        this.Compile(src, type);
    }
    Compile(src, type) {
        this.shader = CompileShader(src, type);
    }
    Attach(program) {
        gl.attachShader(program, this.shader);
    }
    Delete() {
        gl.deleteShader(this.shader);
    }
}

class ShaderProgram {
    constructor() {
        this.program = gl.createProgram();
        this.locationCache = {};
    }
    Link(vs, fs) {
        vs.Attach(this.program);
        fs.Attach(this.program);
        gl.linkProgram(this.program);
    }
    Use() {
        gl.useProgram(this.program);
    }
    getUniformLocation(name) {
        let cache = this.locationCache[name];
        if (cache) {
            return cache;
        }
        this.locationCache[name] = gl.getUniformLocation(this.program, name)
        return this.locationCache[name];
    }
    Send1f(name, v1) {
        gl.uniform1f(this.getUniformLocation(name), v1);
    }
    Send2f(name, v1, v2) {
        gl.uniform2f(this.getUniformLocation(name), v1, v2);
    }
    Send1i(name, v1) {
        gl.uniform1i(this.getUniformLocation(name), v1);
    }
}