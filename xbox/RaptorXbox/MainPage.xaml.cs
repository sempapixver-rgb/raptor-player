using System;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Navigation;

namespace RaptorXbox
{
    /// <summary>
    /// Host do aplicativo UWP para Xbox. A interface vem da copia identica da
    /// edicao LG (www/index.html), carregada de arquivos locais do pacote.
    /// Nao ha redirecionamento para o site publico.
    /// </summary>
    public sealed partial class MainPage : Page
    {
        private const string LocalApp = "ms-appx-web:///www/index.html";

        private const string InstallExitBridge =
            "try{if(window.App){window.App.exitApp=function(){window.location.href='xbox://exit';};}}catch(e){}";

        private const string InvokeBack =
            "try{if(window.App&&window.App.back){window.App.back();}}catch(e){}";

        public MainPage()
        {
            InitializeComponent();

            PlayerWebView.NavigationStarting += OnNavigationStarting;
            PlayerWebView.NavigationCompleted += OnNavigationCompleted;
            SystemNavigationManager.GetForCurrentView().BackRequested += OnBackRequested;

            Loaded += OnLoaded;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            PlayerWebView.Navigate(new Uri(LocalApp));
        }

        /// <summary>
        /// O codigo da LG encerra chamando webOS.platformBack(). No Xbox a saida
        /// e feita por um esquema interno, interceptado aqui antes de sair do app.
        /// </summary>
        private void OnNavigationStarting(WebView sender, WebViewNavigationStartingEventArgs args)
        {
            if (args.Uri != null &&
                string.Equals(args.Uri.Scheme, "xbox", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(args.Uri.Host, "exit", StringComparison.OrdinalIgnoreCase))
            {
                args.Cancel = true;
                Application.Current.Exit();
            }
        }

        private async void OnNavigationCompleted(WebView sender, WebViewNavigationCompletedEventArgs args)
        {
            if (!args.IsSuccess)
            {
                return;
            }

            try
            {
                await sender.InvokeScriptAsync("eval", new[] { InstallExitBridge });
            }
            catch (Exception)
            {
                // O app continua utilizavel se a ponte de saida nao puder ser instalada.
            }
        }

        private async void OnBackRequested(object sender, BackRequestedEventArgs e)
        {
            e.Handled = true;

            try
            {
                await PlayerWebView.InvokeScriptAsync("eval", new[] { InvokeBack });
            }
            catch (Exception)
            {
                // Nada a fazer: o botao Voltar do controle e tratado pela interface.
            }
        }
    }
}
