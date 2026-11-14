"""
Production-Grade Lightweight Spatial-Temporal ConvNet + BiGRU with Attention Pooling
Optimized for real-time in-browser ONNX inference (< 10ms latency, ~2.5 MB model footprint).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class TemporalConvBlock(nn.Module):
    """
    Multi-scale 1D Temporal Convolution capturing short-term finger joint velocities
    and medium-term hand trajectory sweeps.
    """
    def __init__(self, in_channels, out_channels):
        super().__init__()
        # Kernel size 3 captures instantaneous joint velocities
        self.conv3 = nn.Conv1d(in_channels, out_channels // 2, kernel_size=3, padding=1)
        # Kernel size 5 captures extended stroke direction
        self.conv5 = nn.Conv1d(in_channels, out_channels // 2, kernel_size=5, padding=2)

        self.bn = nn.BatchNorm1d(out_channels)
        self.act = nn.GELU()
        self.dropout = nn.Dropout(0.15)

        # Residual shortcut if input and output dimensions differ
        self.shortcut = (
            nn.Conv1d(in_channels, out_channels, kernel_size=1)
            if in_channels != out_channels
            else nn.Identity()
        )

    def forward(self, x):
        # x shape: (batch, channels, time)
        c3 = self.conv3(x)
        c5 = self.conv5(x)
        merged = torch.cat([c3, c5], dim=1)
        out = self.bn(merged)
        out = self.act(out)
        out = self.dropout(out)
        return out + self.shortcut(x)


class TemporalAttention(nn.Module):
    """
    Self-Attention pooling mechanism that automatically identifies and weights
    the core stroke peak of a sign, suppressing transitional entry and exit frames.
    """
    def __init__(self, hidden_dim):
        super().__init__()
        self.proj = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.Tanh(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, rnn_outputs):
        # rnn_outputs shape: (batch, time, hidden_dim)
        scores = self.proj(rnn_outputs)  # (batch, time, 1)
        weights = F.softmax(scores, dim=1)  # (batch, time, 1)
        context = torch.sum(rnn_outputs * weights, dim=1)  # (batch, hidden_dim)
        return context, weights


class ISLSequenceClassifier(nn.Module):
    """
    End-to-End ISL Classifier for 30-frame MediaPipe 3D Landmark Sequences.
    Input: (batch, 30, 138)
    Output: (batch, num_classes)
    """
    def __init__(self, input_dim=138, num_classes=262, conv_dim=128, gru_dim=128):
        super().__init__()
        self.input_dim = input_dim
        self.num_classes = num_classes

        # 1. Temporal Convolutional Feature Extractor
        self.tcn1 = TemporalConvBlock(input_dim, conv_dim)
        self.tcn2 = TemporalConvBlock(conv_dim, conv_dim)

        # 2. Bidirectional GRU (2 layers)
        self.gru = nn.GRU(
            input_size=conv_dim,
            hidden_size=gru_dim,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.2,
        )

        # 3. Attention Pooling over the 30 timestamps
        self.attention = TemporalAttention(hidden_dim=gru_dim * 2)

        # 4. Dense Classification Head
        self.classifier = nn.Sequential(
            nn.Linear(gru_dim * 2, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(0.25),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        # x shape: (batch, time=30, features=138)
        # Permute for 1D convolution: (batch, features=138, time=30)
        x_conv = x.permute(0, 2, 1)
        feat = self.tcn1(x_conv)
        feat = self.tcn2(feat)

        # Permute back for GRU: (batch, time=30, channels=128)
        feat = feat.permute(0, 2, 1)
        rnn_out, _ = self.gru(feat)

        # Attention-weighted temporal pooling
        context, _ = self.attention(rnn_out)

        # Class logits
        logits = self.classifier(context)
        return logits
