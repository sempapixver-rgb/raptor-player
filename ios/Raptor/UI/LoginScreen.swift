import SwiftUI
import UniformTypeIdentifiers

struct LoginScreen: View {
    @EnvironmentObject private var store: RaptorStore

    let onDemo: () -> Void

    @State private var smartLink = ""
    @State private var mode: LoginMode = .service
    @State private var host = ""
    @State private var user = ""
    @State private var password = ""
    @State private var link = ""
    @State private var hint = ""
    @State private var errorMessage = ""
    @State private var loading = false
    @State private var smartFocused = false
    @State private var showImporter = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                BrandHeader(subtitle: "VIDEO PLAYER")
                    .padding(.top, 12)

                ActivationCard { session in
                    login(with: session)
                }

                Button(action: onDemo) {
                    Label("Testar o player (vídeos de exemplo)", systemImage: "play.circle")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .foregroundStyle(RaptorColor.text)
                        .background(RaptorColor.surfaceHigh)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RaptorColor.outline, lineWidth: 1))
                }

                if !store.lists.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: "LISTAS SALVAS")
                        ForEach(store.lists.prefix(6)) { item in
                            HStack(spacing: 10) {
                                Button {
                                    login(with: item)
                                } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.displayName())
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(RaptorColor.text)
                                        Text(item.mode == .service ? "Xtream Codes" : "Lista M3U")
                                            .font(.caption2)
                                            .foregroundStyle(RaptorColor.dim)
                                    }
                                }
                                Spacer()
                                Button("Remover") { store.removeList(item) }
                                    .font(.caption)
                                    .foregroundStyle(RaptorColor.error)
                            }
                            .padding(12)
                            .background(RaptorColor.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("COLE SEU LINK OU SERVIDOR")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RaptorColor.dim)
                    HStack {
                        TextField("http://servidor:8080/get.php?username=...", text: $smartLink)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .foregroundStyle(RaptorColor.text)
                            .padding(12)
                            .background(RaptorColor.black.opacity(0.7))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(RaptorColor.outline, lineWidth: 1))
                            .onChange(of: smartLink) { newValue in
                                detect(newValue)
                            }
                        Button("Colar") {
                            if let pasted = UIPasteboard.general.string { smartLink = pasted }
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RaptorColor.green)
                    }
                    if !hint.isEmpty {
                        Text(hint)
                            .font(.caption)
                            .foregroundStyle(RaptorColor.green)
                    }
                }

                Picker("Tipo de lista", selection: $mode) {
                    Text("Xtream Codes").tag(LoginMode.service)
                    Text("Lista M3U").tag(LoginMode.link)
                }
                .pickerStyle(.segmented)
                .onChange(of: mode) { _ in errorMessage = "" }

                if mode == .service {
                    RaptorField(label: "Servidor (URL ou IP:porta)",
                                placeholder: "http://meuservidor.com:8080",
                                text: $host, keyboard: .URL)
                    RaptorField(label: "Usuário", placeholder: "usuario", text: $user)
                    RaptorField(label: "Senha", placeholder: "senha", text: $password, secure: true)
                } else {
                    RaptorField(label: "URL da lista M3U",
                                placeholder: "http://site.com/lista.m3u",
                                text: $link, keyboard: .URL)
                    Text("Também aceita um arquivo .m3u importado do aparelho.")
                        .font(.caption2)
                        .foregroundStyle(RaptorColor.dim)
                    Button("Importar arquivo .m3u") { showImporter = true }
                        .font(.subheadline)
                        .foregroundStyle(RaptorColor.green)
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(RaptorColor.error)
                        .multilineTextAlignment(.center)
                }

                PrimaryButton(title: loading ? "Entrando…" : "Entrar", enabled: !loading) {
                    submit()
                }

                Text("Ative pelo site ou entre com a sua lista.")
                    .font(.caption)
                    .foregroundStyle(RaptorColor.dim)
                Text("Player de vídeo: você é responsável pelo conteúdo da sua lista.")
                    .font(.caption2)
                    .foregroundStyle(RaptorColor.dim.opacity(0.8))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .raptorScreen()
        .fileImporter(isPresented: $showImporter,
                      allowedContentTypes: [.plainText, .data,
                                            UTType(filenameExtension: "m3u") ?? .plainText,
                                            UTType(filenameExtension: "m3u8") ?? .plainText]) { result in
            switch result {
            case .success(let url):
                guard url.startAccessingSecurityScopedResource() else { return }
                defer { url.stopAccessingSecurityScopedResource() }
                do {
                    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    let destination = docs.appendingPathComponent("playlist-\(Date().timeIntervalSince1970).m3u")
                    try? FileManager.default.removeItem(at: destination)
                    try Data(contentsOf: url).write(to: destination)
                    link = destination.path
                    mode = .link
                    hint = "Arquivo importado. Toque em Entrar."
                } catch {
                    errorMessage = "Falha ao importar: \(error.localizedDescription)"
                }
            case .failure(let error):
                errorMessage = "Falha ao importar: \(error.localizedDescription)"
            }
        }
    }

    private func detect(_ raw: String) {
        guard SmartLink.looksComplete(raw), let found = SmartLink.detect(raw) else { return }
        switch found.mode {
        case .service:
            mode = .service
            host = found.host
            if !found.user.isEmpty { user = found.user }
            if !found.pass.isEmpty { password = found.pass }
            hint = found.user.isEmpty ? "Servidor Xtream detectado." : "Xtream detectado: servidor, usuário e senha preenchidos."
        case .link:
            mode = .link
            link = found.link
            hint = "Lista M3U detectada."
        }
    }

    private func submit() {
        errorMessage = ""
        loading = true
        Task {
            let session: Session
            if mode == .service {
                guard !host.isEmpty, !user.isEmpty, !password.isEmpty else {
                    await MainActor.run { errorMessage = "Preencha servidor, usuário e senha."; loading = false }
                    return
                }
                session = Session(mode: .service, baseUrl: host, username: user, password: password)
            } else {
                guard !link.isEmpty else {
                    await MainActor.run { errorMessage = "Informe a URL da lista ou importe um arquivo .m3u."; loading = false }
                    return
                }
                session = Session(mode: .link, linkUrl: link)
            }
            let result = await makeSource(session).check()
            await MainActor.run {
                loading = false
                if result.isEmpty { store.login(session) }
                else { errorMessage = result }
            }
        }
    }
}

// MARK: - Ativação pelo site

private struct ActivationCard: View {
    @EnvironmentObject private var store: RaptorStore
    let onActivated: (Session) -> Void

    @State private var code = ""
    @State private var status = "Aguardando ativação no site…"
    @State private var checking = false
    @State private var missed = false
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                if let image = Activation.qrImage(from: Activation.siteURL(for: code)?.absoluteString ?? "") {
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .frame(width: 104, height: 104)
                        .padding(6)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("ATIVAR PELO SITE")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(RaptorColor.dim)
                    Text(code)
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundStyle(RaptorColor.green)
                    Text("Escaneie o QR ou use este código no site. O app entra sozinho.")
                        .font(.caption2)
                        .foregroundStyle(RaptorColor.dim)
                    HStack(spacing: 6) {
                        if !missed {
                            ProgressView().tint(RaptorColor.green).scaleEffect(0.7)
                        }
                        Text(status)
                            .font(.caption2)
                            .foregroundStyle(RaptorColor.dim)
                    }
                    Button("Verificar agora") {
                        Task { await check(manual: true) }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RaptorColor.green)
                }
            }
            Text("raptor-player.netlify.app")
                .font(.caption2)
                .foregroundStyle(RaptorColor.dim)

        }
        .padding(14)
        .background(RaptorColor.surface.opacity(0.94))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(RaptorColor.outline, lineWidth: 1))
        .task {
            code = Activation.deviceCode(prefs: store.prefs)
            var attempts = 0
            while !Task.isCancelled {
                await check(manual: false)
                attempts += 1
                let delay = attempts <= 20 ? 5_000_000_000 : 20_000_000_000
                try? await Task.sleep(nanoseconds: UInt64(delay))
            }
        }
    }

    private func check(manual: Bool) async {
        guard !code.isEmpty else { return }
        if manual { status = "Verificando ativação…" }
        checking = true
        if let session = await Activation.fetch(code: code) {
            status = "Ativação recebida. Entrando…"
            await MainActor.run { onActivated(session) }
        } else if manual {
            missed = true
            status = "Ainda não encontrei. Confira o código no site."
        }
        checking = false
    }
}
