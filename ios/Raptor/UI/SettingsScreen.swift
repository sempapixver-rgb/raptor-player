import SwiftUI

struct SettingsScreen: View {
    @EnvironmentObject private var store: RaptorStore
    let onSwitchList: () -> Void
    let onRefresh: () -> Void

    @State private var message = ""
    @State private var showTerms = false
    @State private var checkingAccount = false

    private let actions: [(icon: String, title: String, subtitle: String)] = [
        ("person.circle", "Minha conta", "Status e validade da lista"),
        ("arrow.left.arrow.right", "Trocar lista", "Escolher outra lista salva"),
        ("arrow.clockwise", "Atualizar catálogo", "Recarregar canais, filmes e séries"),
        ("star.slash", "Limpar favoritos", "Remover todos os favoritos"),
        ("clock.badge.xmark", "Limpar histórico", "Remover o histórico"),
        ("doc.text", "Termos de uso", "Player de vídeo: não fornece conteúdo"),
        ("info.circle", "Sobre o Raptor", "Versão e informações"),
        ("rectangle.on.rectangle", "Formato de tela", "Retrato no iPhone, paisagem no player"),
        ("lock.shield", "Privacidade", "Nada é enviado a terceiros")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                accountCard
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                if !message.isEmpty {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(RaptorColor.green)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                }

                VStack(spacing: 8) {
                    ForEach(actions.indices, id: \.self) { index in
                        let action = actions[index]
                        Button { perform(index) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: action.icon)
                                    .font(.system(size: 16))
                                    .foregroundStyle(RaptorColor.green)
                                    .frame(width: 32, height: 32)
                                    .background(RaptorColor.green.opacity(0.12))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(action.title)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(RaptorColor.text)
                                    Text(action.subtitle)
                                        .font(.caption2)
                                        .foregroundStyle(RaptorColor.dim)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(RaptorColor.dim)
                            }
                            .padding(12)
                            .background(RaptorColor.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RaptorColor.outline, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        .raptorScreen()
        .task {
            checkingAccount = true
            await store.checkAccount()
            checkingAccount = false
        }
        .sheet(isPresented: $showTerms) {
            NavigationStack {
                ScrollView {
                    Text(Terms.plainText)
                        .font(.footnote)
                        .foregroundStyle(RaptorColor.dim)
                        .padding(16)
                }
                .raptorScreen()
                .navigationTitle("Termo de uso e responsabilidade")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fechar") { showTerms = false }
                            .foregroundStyle(RaptorColor.green)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "CONTA")
            if checkingAccount {
                StateView(.loading("Verificando conta…"))
            } else if let info = store.account {
                Text(info.username).font(.headline).foregroundStyle(RaptorColor.text)
                Text("Status: \(info.status)\(info.isTrial ? " (teste)" : "")")
                    .font(.caption).foregroundStyle(RaptorColor.dim)
                Text("Validade: \(formatExpiry(info.expiresAt))")
                    .font(.caption).foregroundStyle(RaptorColor.dim)
                Text("Conexões: \(info.activeConnections)/\(info.maxConnections)")
                    .font(.caption).foregroundStyle(RaptorColor.dim)
            } else {
                Text(store.current?.mode == .link
                     ? "Lista M3U - sem dados de conta."
                     : "Não foi possível ler os dados da conta.")
                    .font(.caption).foregroundStyle(RaptorColor.dim)
            }
            if let code = store.prefs.deviceCode() {
                Text("ID do aparelho: \(code)")
                    .font(.caption2)
                    .foregroundStyle(RaptorColor.dim.opacity(0.8))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RaptorColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(RaptorColor.outline, lineWidth: 1))
    }

    private func perform(_ index: Int) {
        message = ""
        switch index {
        case 0:
            checkingAccount = true
            Task {
                await store.checkAccount()
                await MainActor.run { checkingAccount = false }
            }
        case 1: onSwitchList()
        case 2:
            onRefresh()
            message = "Catálogo será recarregado ao voltar para as abas."
        case 3:
            store.clearFavorites()
            message = "Favoritos removidos."
        case 4:
            store.clearRecents()
            message = "Histórico removido."
        case 5: showTerms = true
        case 6: message = "Raptor Player 1.0.0 · Tudo fica salvo apenas neste aparelho."
        case 7: message = "No iPhone o app usa retrato; o player abre em tela cheia e pode girar."
        case 8: message = "As listas e credenciais ficam somente no aparelho."
        default: break
        }
    }

    private func formatExpiry(_ raw: String) -> String {
        guard let seconds = Double(raw), seconds > 0 else { return raw.isEmpty ? "—" : raw }
        let date = Date(timeIntervalSince1970: seconds)
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM/yyyy"
        return formatter.string(from: date)
    }
}
