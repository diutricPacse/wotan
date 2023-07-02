# How to Install OpenVPN Server and Client with Easy-RSA 3 on CentOS 7
 
OpenVPN is a popular open-source VPN software that allows you to create secure and encrypted connections between your devices and a VPN server. Easy-RSA is a command-line tool that simplifies the process of generating and managing certificates and keys for OpenVPN. In this tutorial, we will show you how to install OpenVPN server and client with Easy-RSA 3 on CentOS 7.
 
## Prerequisites
 
Before you begin, you will need the following:
 
**DOWNLOAD ⚹ [https://www.google.com/url?q=https%3A%2F%2Furluss.com%2F2uy6Hl&sa=D&sntz=1&usg=AOvVaw2yknxNbyeeIiDKl729RfRS](https://www.google.com/url?q=https%3A%2F%2Furluss.com%2F2uy6Hl&sa=D&sntz=1&usg=AOvVaw2yknxNbyeeIiDKl729RfRS)**


 
- A CentOS 7 server with root access.
- A CentOS 7 client machine that you want to connect to the VPN server.
- A domain name or a public IP address for your VPN server.
- A firewall that allows UDP traffic on port 1194 (the default OpenVPN port).

## Step 1: Install OpenVPN and Easy-RSA on the Server
 
First, we need to install the EPEL repository on the server, which provides additional packages for CentOS:

    sudo yum install epel-release -y

Next, we can install OpenVPN and Easy-RSA from the EPEL repository:
 
How to set up OpenVPN with Easy-RSA 3 on CentOS 7 server,  CentOS 7 OpenVPN installation and configuration guide with Easy-RSA 3,  Easy-RSA 3 OpenVPN tutorial for CentOS 7 users,  How to create and manage OpenVPN certificates with Easy-RSA 3 on CentOS 7,  How to secure your OpenVPN connection with Easy-RSA 3 on CentOS 7,  How to install and use OpenVPN GUI client on CentOS 7 with Easy-RSA 3,  How to troubleshoot OpenVPN issues on CentOS 7 with Easy-RSA 3,  How to update OpenVPN and Easy-RSA 3 on CentOS 7,  How to enable and disable OpenVPN service on CentOS 7 with Easy-RSA 3,  How to backup and restore OpenVPN settings and certificates on CentOS 7 with Easy-RSA 3,  How to customize OpenVPN server and client options with Easy-RSA 3 on CentOS 7,  How to connect multiple devices to OpenVPN server on CentOS 7 with Easy-RSA 3,  How to monitor and optimize OpenVPN performance on CentOS 7 with Easy-RSA 3,  How to add and revoke OpenVPN users with Easy-RSA 3 on CentOS 7,  How to configure firewall and routing rules for OpenVPN on CentOS 7 with Easy-RSA 3,  How to integrate OpenVPN with LDAP or Active Directory on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for site-to-site VPN on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for remote access VPN on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for split tunneling on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for bridging networks on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for bypassing censorship and geo-restrictions on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for enhancing privacy and security on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for torrenting and streaming on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for gaming and VoIP on CentOS 7 with Easy-RSA 3,  How to use OpenVPN for file sharing and collaboration on CentOS 7 with Easy-RSA 3,  How to install and configure Pi-hole with OpenVPN on CentOS 7 with Easy-RSA 3,  How to install and configure WireGuard with OpenVPN on CentOS 7 with Easy-RSA 3,  How to install and configure SoftEther VPN with OpenVPN on CentOS 7 with Easy-RSA

    sudo yum install openvpn easy-rsa -y

This will also install some dependencies, such as openssl and lzo.
 
## Step 2: Configure Easy-RSA on the Server
 
Easy-RSA uses a configuration file called vars to store some variables that are used for generating certificates and keys. We need to edit this file and customize it according to our needs.
 
The vars file is located in the /usr/share/easy-rsa/3/ directory. We can make a copy of it in the /etc/openvpn/easy-rsa/ directory, which is where we will run the Easy-RSA commands:

    sudo mkdir /etc/openvpn/easy-rsa
    sudo cp /usr/share/easy-rsa/3/vars /etc/openvpn/easy-rsa/

Then, we can edit the vars file with our preferred text editor:

    sudo nano /etc/openvpn/easy-rsa/vars

We need to change the following variables:

- **set\_var EASYRSA\_REQ\_COUNTRY**: The two-letter country code of your location.
- **set\_var EASYRSA\_REQ\_PROVINCE**: The name of your state or province.
- **set\_var EASYRSA\_REQ\_CITY**: The name of your city.
- **set\_var EASYRSA\_REQ\_ORG**: The name of your organization.
- **set\_var EASYRSA\_REQ\_EMAIL**: The email address of your organization.
- **set\_var EASYRSA\_REQ\_OU**: The name of your organizational unit.
- **set\_var EASYRSA\_KEY\_SIZE**: The size of the RSA keys in bits. The default is 2048, but you can increase it to 4096 for more security.
- **set\_var EASYRSA\_ALGO**: The algorithm used for generating keys. The default is rsa, but you can also use ec (elliptic curve) or ed (EdDSA).
- **set\_var EASYRSA\_CA\_EXPIRE**: The number of days that the CA certificate is valid. The default is 3650 (10 years).
- **set\_var EASYRSA\_CERT\_EXPIRE**: The number of days that the server and client certificates are valid. The default is 825 (2.25 years).
- **set\_var EASYRSA\_NS\_SUPPORT**: Whether to add Netscape extensions to the certificates. The default is no, but you can set it to yes if you need compatibility with older clients.
- **set\_var EASYRSA\_NS\_COMMENT**: A comment that will be added to the certificates if NS\_SUPPORT is set to yes.

 8cf37b1e13
 
