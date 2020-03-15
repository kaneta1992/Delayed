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
    SendTexture2D(name, texture, slot) {
        texture.Activate(slot);
        this.Send1i(name, slot);
    }
}

class Texture2D {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.texture = gl.createTexture();
    }
    Bind() {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    UnBind() {
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    SetImageData(imageData, type) {
        this.Bind();
        if (type == gl.UNSIGNED_BYTE) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, type, imageData);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, type, imageData);
        }
        
        // MipMapを利用する際は、MipMapレベルにちゃんとデータが描画されていることを確認すべし
        // 5時間悩んだ
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //gl.generateMipmap(gl.TEXTURE_2D);

        this.UnBind();
    }
    Activate(slot) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        this.Bind();
    }
    GenerateMipMap() {
        this.Bind();
        gl.generateMipmap(gl.TEXTURE_2D);
        this.UnBind();
    }
    SetFilter(mag, min) {
        this.Bind();
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
        this.UnBind();
    }
}

class RenderTexture {
    constructor(width, height, type) {
        this.width = width;
        this.height = height;
        this.framebuffer = gl.createFramebuffer();
        this.texture = new Texture2D(width, height);
        this.texture.SetImageData(null, type);
        this.Bind();
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture.texture, 0);
        this.UnBind();
    }
    Bind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        var bufferList = [
            gl.COLOR_ATTACHMENT0
        ];
        gl.drawBuffers(bufferList);
    }

    UnBind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    SetViewport() {
        gl.viewport(0.0, 0.0, this.width, this.height);
    }
}

class MRTTexture4 {
    constructor(width, height, type) {
        this.width = width;
        this.height = height;
        this.framebuffer = gl.createFramebuffer();


        this.texture0 = new Texture2D(width, height);
        this.texture0.SetImageData(null, type);

        this.texture1 = new Texture2D(width, height);
        this.texture1.SetImageData(null, type);

        this.texture2 = new Texture2D(width, height);
        this.texture2.SetImageData(null, type);

        this.texture3 = new Texture2D(width, height);
        this.texture3.SetImageData(null, type);

        this.Bind();
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture0.texture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.texture1.texture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.texture2.texture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.texture3.texture, 0);
        this.UnBind();
    }
    Bind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        var bufferList = [
            gl.COLOR_ATTACHMENT0,
            gl.COLOR_ATTACHMENT1,
            gl.COLOR_ATTACHMENT2,
            gl.COLOR_ATTACHMENT3
        ];
        gl.drawBuffers(bufferList);
    }

    UnBind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    SetViewport() {
        gl.viewport(0.0, 0.0, this.width, this.height);
    }
}